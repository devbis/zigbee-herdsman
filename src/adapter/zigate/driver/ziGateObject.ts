import Frame from './frame';
import ZiGateFrame from './frame';
import BuffaloZiGate, {BuffaloZiGateOptions} from './buffaloZiGate';
import {ZiGateCommandCode, ZiGateMessageCode, ZiGateObjectPayload} from "./constants";
import {ZiGateMessage, ZiGateMessageParameter} from "./messageType";
import {ZiGateCommand, ZiGateCommandParameter, ZiGateCommandType} from "./commandType";
import {Debug} from '../debug';

type ZiGateCode = ZiGateCommandCode | ZiGateMessageCode;
type ZiGateParameter = ZiGateCommandParameter | ZiGateMessageParameter;


const debug = Debug('driver:ziGateObject');

class ZiGateObject {
    private readonly _code: ZiGateCode;
    private readonly _payload: ZiGateObjectPayload;
    private readonly _parameters: ZiGateParameter[];
    private readonly _frame: ZiGateFrame;

    private constructor(
        code: ZiGateCode,
        payload: ZiGateObjectPayload,
        parameters: ZiGateParameter[],
        frame?: ZiGateFrame
    ) {
        this._code = code;
        this._payload = payload;
        this._parameters = parameters;
        this._frame = frame;
    }

    get code(): ZiGateCode {
        return this._code;
    }

    get frame(): ZiGateFrame {
        return this._frame;
    }

    get payload(): ZiGateObjectPayload {
        return this._payload;
    }

    get command(): ZiGateCommandType {
        return ZiGateCommand[this._code];
    }

    public static createRequest(
        commandCode: ZiGateCommandCode,
        payload: ZiGateObjectPayload
    ): ZiGateObject {
        const cmd = ZiGateCommand[commandCode];

        if (!cmd) {
            throw new Error(`Command '${commandCode}' not found`);
        }

        return new ZiGateObject(commandCode, payload, cmd.request);
    }

    public static fromZiGateFrame(frame: Frame): ZiGateObject {
        const code = frame.readMsgCode();
        const msg = ZiGateMessage[code];

        if (!msg) {
            debug.error(`Message '${code.toString(16)}' not found`);
            return;
        }

        const parameters = msg.response;
        // debug.log(msg);

        if (parameters === undefined) {
            debug.error(`Message '${code.toString(16)}' cannot be a response`);
            return;
        }

        const payload = this.readParameters(frame.msgPayloadBytes, parameters);

        return new ZiGateObject(code, payload, parameters, frame);
    }

    private static readParameters(buffer: Buffer, parameters: ZiGateParameter[]): ZiGateObjectPayload {
        const buffalo = new BuffaloZiGate(buffer);
        const result: ZiGateObjectPayload = {};

        for (const parameter of parameters) {
            const options: BuffaloZiGateOptions = {};

            // if (parameter.parameterType === 'ADDRESS_WITH_TYPE_DEPENDENCY') {
            //     const typeParameter = parameters[parameters.indexOf(parameter) - 1];
            //
            //     parameter.parameterType =
            //         result[typeParameter.parameterType] === 'short' ?
            //             ParameterType.UINT8 : ParameterType.IEEEADDR; // @TODO
            // }

            result[parameter.name] = buffalo.read(parameter.parameterType, options);
        }
        return result;
    }

    public toZiGateFrame(): Frame {
        const buffer = this.createPayloadBuffer();
        const frame = new Frame();
        frame.writeMsgCode(this._code as number);
        frame.writeMsgPayload(buffer);
        return frame;
    }

    private createPayloadBuffer(): Buffer {
        const buffalo = new BuffaloZiGate(Buffer.alloc(256)); // hardcode @todo

        for (const parameter of this._parameters) {
            const value = this._payload[parameter.name];
            buffalo.write(parameter.parameterType, value, {});
        }
        return buffalo.getBuffer().slice(0, buffalo.getPosition());
    }

}

export default ZiGateObject;
