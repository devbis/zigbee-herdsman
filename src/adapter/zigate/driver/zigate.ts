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
import {equal, ZiGateResponseMatcher, ZiGateResponseMatcherRule} from "./commandType";

const debug = Debug('driver');

const autoDetectDefinitions = [
    {manufacturer: 'zz', vendorId: 'id', productId: '00'},
];
const timeouts = {
    reset: 30000,
    default: 10000,
};

type WaitressMatcher = {
    ziGateObject: ZiGateObject,
    rules: ZiGateResponseMatcher
};

function zeroPad(number: number, size?: number): string {
    return (number).toString(16).padStart(size || 4, '0');
}

function resolve(path: string | [], obj: { [k: string]: any }, separator = '.'): any {
    const properties = Array.isArray(path) ? path : path.split(separator);
    return properties.reduce((prev, curr) => prev && prev[curr], obj);
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
    public portWrite: SerialPort | net.Socket;
    private waitress: Waitress<ZiGateObject, WaitressMatcher>;

    public constructor(path: string, serialPortOptions: SerialPortOptions) {
        super();
        // eslint-disable-next-line prefer-rest-params
        debug.log('construct', arguments);
        this.path = path;
        this.baudRate = typeof serialPortOptions.baudRate === 'number' ? serialPortOptions.baudRate : 1000000;
        this.rtscts = typeof serialPortOptions.rtscts === 'boolean' ? serialPortOptions.rtscts : false;
        this.portType = SocketPortUtils.isTcpPath(path) ? 'socket' : 'serial';
        this.initialized = false;
        this.queue = new Queue(1);

        this.waitress = new Waitress<ZiGateObject, WaitressMatcher>(
            this.waitressValidator, this.waitressTimeoutFormatter);

    }

    public async sendCommand(
        code: ZiGateCommandCode,
        payload?: ZiGateObjectPayload,
        timeout?: number
    ): Promise<ZiGateObject> {

        const waiters: Promise<ZiGateObject>[] = [];
        const statusResponse: ZiGateObject = await this.queue.execute(async () => {
            try {
                debug.log(
                    'Send command \x1b[42m>>>> '
                    + ZiGateCommandCode[code]
                    + ' 0x' + zeroPad(code)
                    + ' <<<<\x1b[0m ',
                );
                debug.log('payload: ', payload);

                const ziGateObject = ZiGateObject.createRequest(code, payload);
                const frame = ziGateObject.toZiGateFrame();
                debug.log('Send command buff: ', frame);

                const sendBuffer = frame.toBuffer();
                debug.log('Send command buff: ', sendBuffer);


                if (Array.isArray(ziGateObject.command.response)) {
                    ziGateObject.command.response.forEach((rules) => {
                        waiters.push(
                            this.waitress.waitFor({ziGateObject, rules}, timeout || timeouts.default
                            ).start().promise);
                    });

                }

                const ruleStatus: ZiGateResponseMatcher = [
                    {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                    {receivedProperty: 'payload.packetType', matcher: equal, value: ziGateObject.code},
                ];

                const statusWaiter = this.waitress.waitFor(
                    {ziGateObject, rules: ruleStatus},
                    timeout || timeouts.default
                ).start();

                // @ts-ignore
                this.portWrite.write(sendBuffer);

                return statusWaiter.promise;
            } catch (e) {
                debug.error(e);
                return Promise.reject();
            }
        });

        if (statusResponse.payload.status === 0) {
            if (waiters.length > 0) {
                return Promise.race(waiters);
            } else {
                return Promise.resolve(statusResponse);
            }
        }

        // else
        return Promise.reject(statusResponse);
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
        debug.error('close');
        return new Promise((resolve, reject) => {
            if (this.initialized) {

                this.initialized = false;
                this.portWrite = null;
                if (this.portType === 'serial') {
                    this.serialPort.flush((): void => {
                        this.serialPort.close((error): void => {
                            this.serialPort = null;
                            error == null ?
                                resolve() :
                                reject(new Error(`Error while closing serialPort '${error}'`));
                            this.emit('close');
                        });
                    });
                } else {
                    // @ts-ignore
                    this.socketPort.destroy((error?: Error): void => {
                        this.socketPort = null;
                        error == null ?
                            resolve() :
                            reject(new Error(`Error while closing serialPort '${error}'`));
                        this.emit('close');
                    });
                }
            } else {
                resolve();
                this.emit('close');
            }
        });
    }

    public waitFor(matcher: WaitressMatcher, timeout: number = timeouts.default):
        { start: () => { promise: Promise<ZiGateObject>; ID: number }; ID: number } {
        return this.waitress.waitFor(matcher, timeout);
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
                // reject(new Error(`Error while opening socket`));
                reject();
                self.initialized = false;
            });

            this.socketPort.connect(info.port, info.host);
        });
    }

    private onSerialError(err: string): void {
        debug.error('serial error: ', err);
    }

    private onPortClose(): void {
        debug.log('serial closed');
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
                msgName += ' 0x' + zeroPad(code);
            } catch (e) {

            }
            debug.log(`--> parsed frame \x1b[1;34m>>>> ${msgName} <<<<`);
            // debug.log(frame);

            try {
                const ziGateObject = ZiGateObject.fromZiGateFrame(frame);

                if (ziGateObject === undefined)
                    return;
                this.waitress.resolve(ziGateObject);

                if (code !== ZiGateMessageCode.Status || ziGateObject.payload.status !== 0) {
                    debug.info(`--> frame to object `, ziGateObject.payload);
                }
                if (code === ZiGateMessageCode.DataIndication) {

                    const zclFrame = ZclFrame.fromBuffer(
                        // @ts-ignore
                        ziGateObject.payload.clusterID,
                        ziGateObject.payload.payload
                    );
                    debug.info('raw', zclFrame);

                    this.emit('received', {ziGateObject, zclFrame});
                } else if (code === ZiGateMessageCode.LeaveIndication) {
                    this.emit('LeaveIndication', {ziGateObject});
                } else if (code === ZiGateMessageCode.DeviceAnnounce) {
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
        return `${matcher} after ${timeout}ms`;
    }

    private waitressValidator(ziGateObject: ZiGateObject, matcher: WaitressMatcher): boolean {

        const validator = (rule: ZiGateResponseMatcherRule): boolean => {
            try {
                let expectedValue: string | number;
                if (typeof rule.value === "undefined" && typeof rule.expectedProperty !== "undefined") {
                    expectedValue = resolve(rule.expectedProperty, matcher.ziGateObject);
                } else {
                    expectedValue = rule.value;
                }
                const receivedValue = resolve(rule.receivedProperty, ziGateObject);

                // debug.info(expectedValue, receivedValue, rule);
                return rule.matcher(expectedValue, receivedValue);
            } catch (e) {
                return false;
            }
        };
        return matcher.rules.every(validator);
    }
}
