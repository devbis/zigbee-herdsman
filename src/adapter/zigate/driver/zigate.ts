import SerialPort from 'serialport';
import Frame from './frame';
import ZiGateFrame from './frame';
import {EventEmitter} from 'events';
import {Debug} from '../debug';
import SerialPortUtils from "../../serialPortUtils";
import SocketPortUtils from "../../socketPortUtils";
import net from "net";
import {Queue} from "../../../utils";
import {SerialPortOptions} from "../../tstype";
import {ZiGateCommandCode, ZiGateObjectPayload} from "./constants";
import ZiGateObject from "./ziGateObject";
import {ZclFrame} from "../../../zcl";

const debug = Debug('driver');

const autoDetectDefinitions = [
    {manufacturer: 'zz', vendorId: 'id', productId: '00'},
];

// interface WaitressMatcher {
//     responseType: Type; // Тип status или обрабатываемый response
//     command: string;
// }

export default class ZiGate extends EventEmitter {
    private path: string;
    private baudRate: number;
    private rtscts: boolean;
    private initialized: boolean;
    // private timeoutResetTimeout: any;
    // private apsRequestFreeSlots: number;

    private parser: EventEmitter;
    private serialPort: SerialPort;
    private seqNumber: number;
    private portType: 'serial' | 'socket';
    private socketPort: net.Socket;
    private queue: Queue;

    // private waitress: Waitress<ZpiObject, WaitressMatcher>;
    private portWrite: any;

    public constructor(path: string, serialPortOptions: SerialPortOptions) {
        super();
        // eslint-disable-next-line prefer-rest-params
        debug.log('construct', arguments);
        this.path = path;
        this.baudRate = typeof serialPortOptions.baudRate === 'number' ? serialPortOptions.baudRate : 115200;
        this.rtscts = typeof serialPortOptions.rtscts === 'boolean' ? serialPortOptions.rtscts : false;
        this.portType = SocketPortUtils.isTcpPath(path) ? 'socket' : 'serial';
        this.initialized = false;
        this.queue = new Queue();
        // this.waitress = new Waitress<ZpiObject, WaitressMatcher>
        // (this.waitressValidator, this.waitressTimeoutFormatter);

    }

    public static async isValidPath(path: string): Promise<boolean> {
        return SerialPortUtils.is(path, autoDetectDefinitions);
    }

    public static async autoDetectPath(): Promise<string> {
        const paths = await SerialPortUtils.find(autoDetectDefinitions);
        return paths.length > 0 ? paths[0] : null;
    }

    public open(): Promise<void> {
        return this.portType === 'serial' ? this.openSerialPort() : this.openSocketPort();
    }

    public close(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (this.initialized) {
                if (this.portType === 'serial') {
                    this.serialPort.flush((): void => {
                        this.serialPort.close((error): void => {
                            this.initialized = false;
                            error == null ?
                                resolve() :
                                reject(new Error(`Error while closing serialPort '${error}'`));
                            this.emit('close');
                        });
                    });
                } else {
                    this.socketPort.destroy();
                    resolve();
                }
            } else {
                resolve();
                this.emit('close');
            }
        });
    }

    public sendCommand(code: ZiGateCommandCode, payload?: ZiGateObjectPayload): Promise<void> { // @TODO ?

        try {
            debug.log('Send command payload: ', arguments);
            const zgCmd = ZiGateObject.createRequest(code, payload);
            const frame = zgCmd.toZiGateFrame();

            const sendBuffer = frame.toBuffer();
            debug.log('Send command buff: ', sendBuffer);


            this.portWrite.write(Uint8Array.from([ZiGateFrame.START_BYTE]));
            this.portWrite.write(sendBuffer);
            this.portWrite.write(Uint8Array.from([ZiGateFrame.STOP_BYTE]));
            return new Promise((resolve) => {
                resolve();
            });
        } catch (e) {
            debug.error(e);
            return new Promise((resolve, reject) => {
                reject();
            });
        }

    }

    private async openSerialPort(): Promise<void> {
        this.serialPort = new SerialPort(this.path, {
            baudRate: this.baudRate,
            dataBits: 8,
            parity: 'none', /* one of ['none', 'even', 'mark', 'odd', 'space'] */
            stopBits: 1, /* one of [1,2] */
            lock: false,
            autoOpen: false
        });

        this.parser = this.serialPort.pipe(
            new SerialPort.parsers.Delimiter(
                {delimiter: [Frame.STOP_BYTE], includeDelimiter: true}
            ),
        );
        this.parser.on('data', this.onSerialData.bind(this));

        this.portWrite = this.serialPort
        return new Promise((resolve, reject): void => {
            this.serialPort.open(async (err: unknown): Promise<void> => {
                if (err) {
                    this.serialPort = null;
                    this.parser = null;
                    this.path = null;
                    this.initialized = false;
                    const error = `Error while opening serialPort '${err}'`;
                    debug.error(error);
                    reject(new Error(error));
                } else {
                    debug.log('Successfully connected ZiGate port \'' + this.path + '\'');
                    this.serialPort.on('error', (error) => {
                        debug.error(`serialPort error: ${error}`);
                    });
                    this.serialPort.on('close', this.onPortClose.bind(this));
                    this.initialized = true;
                    resolve();
                }
            });
        });
    }

    private async openSocketPort(): Promise<void> {
        const info = SocketPortUtils.parseTcpPath(this.path);
        debug.log(`Opening TCP socket with ${info.host}:${info.port}`);

        this.socketPort = new net.Socket();
        this.socketPort.setNoDelay(true);
        this.socketPort.setKeepAlive(true, 15000);


        this.parser = this.socketPort.pipe(
            new SerialPort.parsers.Delimiter({delimiter: [Frame.STOP_BYTE], includeDelimiter: true}),
        );
        this.parser.on('data', this.onSerialData);

        this.portWrite = this.socketPort;
        return new Promise((resolve, reject): void => {
            this.socketPort.on('connect', function () {
                debug.log('Socket connected');
            });

            // eslint-disable-next-line
            const self = this;

            this.socketPort.on('ready', async function () {
                debug.log('Socket ready');
                self.initialized = true;
                resolve();
            });

            this.socketPort.once('close', this.onPortClose);

            this.socketPort.on('error', (error) => {
                debug.log('Socket error', error);
                reject(new Error(`Error while opening socket`));
                self.initialized = false;
            });

            this.socketPort.connect(info.port, info.host);
        });
    }

    private onSerialData(buffer: Buffer): void {
        try {
            debug.log(`--- parseNext [${[...buffer]}]`);
            const frame = new Frame(buffer);
            debug.log(`--> parsed `, frame);
            //

            try {
                const ziGateObject = ZiGateObject.fromZiGateFrame(frame);
                debug.log(`--> frame to object `, ziGateObject.code, ziGateObject.payload);
                if (frame.readMsgCode() === 0x8002) {
                    debug.log('raw');

                    // @ts-ignore
                    debug.log(ZclFrame.fromBuffer(ziGateObject.payload.clusterID, frame.msgPayloadBytes));
                }
            } catch (error) {

                debug.error(`'${error.stack}'`);
            }


            this.emit('receivedData', frame);
        } catch (error) {
            debug.error(`Error while parsing to ZiGateObject '${error.stack}'`);
        }
    }

    private onSerialError(err: string): void {
        debug.error('serial error: ', err);
    }

    private onPortClose(): void {
        debug.log('serial ' + this.path + ' closed');
        this.initialized = false;
        this.emit('close');
    }

    // public waitFor(
    //     type: Type, subsystem: Subsystem, command: string, payload: ZpiObjectPayload = {},
    //     timeout: number = timeouts.default
    // ): {start: () => {promise: Promise<ZpiObject>; ID: number}; ID: number} {
    //     return this.waitress.waitFor({type, subsystem, command, payload}, timeout);
    // }
    //
    // private waitressTimeoutFormatter(matcher: WaitressMatcher, timeout: number): string {
    //     return `${Type[matcher.type]} - ${Subsystem[matcher.subsystem]} - ${matcher.command} after ${timeout}ms`;
    // }
    //
    // private waitressValidator(zpiObject: ZpiObject, matcher: WaitressMatcher): boolean {
    //     const requiredMatch = matcher.type === zpiObject.type && matcher.subsystem == zpiObject.subsystem &&
    //         matcher.command === zpiObject.command;
    //     let payloadMatch = true;
    //
    //     if (matcher.payload) {
    //         for (const [key, value] of Object.entries(matcher.payload)) {
    //             if (!Equals(zpiObject.payload[key], value)) {
    //                 payloadMatch = false;
    //                 break;
    //             }
    //         }
    //     }
    //
    //     return requiredMatch && payloadMatch;
    // }
}
