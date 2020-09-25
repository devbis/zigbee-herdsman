import SerialPort from 'serialport';
import Frame from './frame';
import {EventEmitter} from 'events';
import {Debug} from '../debug';
import SerialPortUtils from "../../serialPortUtils";
import SocketPortUtils from "../../socketPortUtils";
import net from "net";
import {Queue} from "../../../utils";
import {SerialPortOptions} from "../../tstype";
import {ZiGateCommandCode, ZiGateMessageCode, ZiGateObjectPayload} from "./constants";
import ZiGateObject from "./ziGateObject";
import {ZclFrame} from "../../../zcl";
import Waitress from "../../../utils/waitress";
import {ZiGateCommand} from "./commandType";

const debug = Debug('driver');

const autoDetectDefinitions = [
    {manufacturer: 'zz', vendorId: 'id', productId: '00'},
];
const timeouts = {
    default: 1000
};

interface WaitressMatcher {
    responseType?: number | boolean; // Тип status или обрабатываемый response
    commandCode?: number;
}

function DecimalHexTwosComplement(decimal: number) {
    let size = 4;

    if (decimal >= 0) {
        let hexadecimal = decimal.toString(16);

        while ((hexadecimal.length % size) != 0) {
            hexadecimal = "" + 0 + hexadecimal;
        }

        return hexadecimal;
    } else {
        let hexadecimal = Math.abs(decimal).toString(16);
        while ((hexadecimal.length % size) != 0) {
            hexadecimal = "" + 0 + hexadecimal;
        }

        let output = '';
        for (let i = 0; i < hexadecimal.length; i++) {
            output += (0x0F - parseInt(hexadecimal[i], 16)).toString(16);
        }

        output = (0x01 + parseInt(output, 16)).toString(16);
        return output;
    }
}

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
    public portWrite: any;
    private waitress: Waitress<ZiGateObject, WaitressMatcher>;

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

        this.waitress = new Waitress<ZiGateObject, WaitressMatcher>(
            this.waitressValidator, this.waitressTimeoutFormatter);

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

    public async sendCommand(code: ZiGateCommandCode, payload?: ZiGateObjectPayload): Promise<void | ZiGateObject> { // @TODO ?

        const argument = arguments;
        return this.queue.execute(async () => {
            try {
                debug.log('Send command \x1b[42m>>>> ' + ZiGateCommandCode[code] + ' 0x' + DecimalHexTwosComplement(code)
                    + ' <<<<\x1b[0m ');
                debug.log('payload: ', argument[1]);

                const ziGateObject = ZiGateObject.createRequest(code, payload);
                const frame = ziGateObject.toZiGateFrame();

                const sendBuffer = frame.toBuffer();
                debug.log('Send command buff: ', sendBuffer);

                let waiter;
                if (ziGateObject.command.wait_response) {
                    waiter = this.waitress.waitFor({
                            responseType: ziGateObject.command.wait_response,
                            commandCode: ziGateObject.code
                        }, timeouts.default
                    );
                } else if (ziGateObject.command.wait_status) {
                    waiter = this.waitress.waitFor(
                        {responseType: 0x8000, commandCode: ziGateObject.code},
                        timeouts.default
                    );
                }

                this.portWrite.write(sendBuffer);

                return waiter.start().promise;
            } catch (e) {
                debug.error(e);
                return new Promise((resolve, reject) => {
                    reject();
                });
            }
        });
    }

    public waitFor(
        responseType: number, command: number, timeout: number = timeouts.default
    ): { start: () => { promise: Promise<ZiGateObject>; ID: number }; ID: number } {
        return this.waitress.waitFor({responseType, commandCode: command}, timeout);
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

        this.portWrite = this.serialPort;
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
        this.parser.on('data', this.onSerialData.bind(this));

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

    private onSerialError(err: string): void {
        debug.error('serial error: ', err);
    }

    private onPortClose(): void {
        debug.log('serial ' + this.path + ' closed');
        this.initialized = false;
        this.emit('close');
    }

    private onSerialData(buffer: Buffer): void {
        try {
            debug.log(`--- parseNext `, buffer);
            const frame = new Frame(buffer);
            const code = frame.readMsgCode();

            let msgName;
            try {
                msgName = ZiGateMessageCode[code] ? ZiGateMessageCode[code] : '';
                msgName += ' 0x' + DecimalHexTwosComplement(code);
            } catch (e) {

            }
            debug.log(`--> parsed frame \x1b[1;34m>>>> ${msgName} <<<<`);
            // debug.log(frame);

            try {
                const ziGateObject = ZiGateObject.fromZiGateFrame(frame);

                if (ziGateObject === undefined)
                    return;
                // debug.log(ziGateObject.payload, frame.readRSSI());
                this.waitress.resolve(ziGateObject);

                if (code !== ZiGateMessageCode.Status || ziGateObject.payload.status !== 0) {
                    debug.info(`--> frame to object `, ziGateObject.payload);
                }
                if (code === ZiGateMessageCode.DataIndication) {
                    debug.info('raw');

                    // @ts-ignore
                    const zclFrame = ZclFrame.fromBuffer(ziGateObject.payload.clusterID, ziGateObject.payload.payload);
                    this.emit('received', {ziGateObject, zclFrame});
                } else if (code === ZiGateMessageCode.LeaveIndication) {
                    debug.log('raw leave');
                    this.emit('LeaveIndication', {ziGateObject});
                } else if (code === ZiGateMessageCode.DeviceAnnounce) {
                    debug.log('raw announce');
                    this.emit('DeviceAnnounce', {ziGateObject});
                }
            } catch (error) {

                this.emit('receivedRaw', {error, frame});
                // debug.error(`'${error.stack}'`);
            }


        } catch (error) {
            debug.error(`Error while parsing to ZiGateObject '${error.stack}'`);
        }
    }

    private waitressTimeoutFormatter(matcher: WaitressMatcher, timeout: number): string {
        return `${matcher.responseType} - ${matcher.commandCode} after ${timeout}ms`;
    }

    private waitressValidator(ziGateObject: ZiGateObject, matcher: WaitressMatcher): boolean {
        let requiredMatch: boolean;


        // Если статус , пакет тип совпал , то ловим только если ожидает. или код не 0
        if (ziGateObject.code === ZiGateMessageCode.Status) {
            requiredMatch = matcher.commandCode === ziGateObject.payload.packetType
                && (
                    (ZiGateCommand[matcher.commandCode] !== undefined && ZiGateCommand[matcher.commandCode].wait_status === true)
                    ||
                    ziGateObject.payload.status !== 0
                );
        } else if (ziGateObject.code === ZiGateMessageCode.DataIndication) {
            requiredMatch = matcher.commandCode === ziGateObject.payload.clusterID;
        } else {
            requiredMatch = ziGateObject.code === matcher.responseType;
        }

        return requiredMatch;
    }
}
