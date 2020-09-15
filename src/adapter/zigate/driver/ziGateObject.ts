import Frame from './frame';
import BuffaloZiGate, {BuffaloZiGateOptions} from './buffaloZiGate';
import ParameterType from './parameterType';
import {ZiGateCommandCode, ZiGateMessageCode, ZiGateObjectPayload} from "./constants";
import {ZiGateMessage, ZiGateMessageParameter} from "./messageType";
import {ZiGateCommand, ZiGateCommandParameter} from "./commandType";
import {Debug} from '../debug';

type ZiGateCode = ZiGateCommandCode | ZiGateMessageCode;
type ZiGateParameter = ZiGateCommandParameter | ZiGateMessageParameter;


const debug = Debug('driver:ziGateObject');

class ZiGateObject {
    public readonly code: ZiGateCode;
    public readonly payload: ZiGateObjectPayload;
    private readonly parameters: ZiGateParameter[];

    private constructor(
        code: ZiGateCode,
        payload: ZiGateObjectPayload,
        parameters: ZiGateParameter[],
    ) {
        this.code = code;
        this.payload = payload;
        this.parameters = parameters;
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

    public toZiGateFrame(): Frame {
        const buffer = this.createPayloadBuffer();
        const frame = new Frame();
        frame.writeMsgCode(this.code as number);
        frame.writeMsgPayload(buffer)
        return frame;
    }

    public static fromZiGateFrame(frame: Frame): ZiGateObject {
        const code = frame.readMsgCode();
        const msg = ZiGateMessage[code];

        if (!msg) {
            throw new Error(`Message '${code}' not found`);
        }

        const parameters = msg.response;

        if (parameters === undefined) {
            throw new Error(`Message '${code}' cannot be a response`);
        }

        const payload = this.readParameters(frame.msgPayloadBytes, parameters);
        return new ZiGateObject(code, payload, parameters);
    }

    private static readParameters(buffer: Buffer, parameters: ZiGateParameter[]): ZiGateObjectPayload {
        const buffalo = new BuffaloZiGate(buffer);
        const result: ZiGateObjectPayload = {};

        for (const parameter of parameters) {
            const options: BuffaloZiGateOptions = {};

            if (parameter.parameterType === ParameterType.ADDRESS_WITH_TYPE_DEPENDENCY) {
                const typeParameter = parameters[parameters.indexOf(parameter) - 1];

                parameter.parameterType =
                    result[typeParameter.parameterType] === 'short' ?
                        ParameterType.UINT8 : ParameterType.IEEEADDR; // @TODO
            }

            result[parameter.name] = buffalo.read(ParameterType[parameter.parameterType], options);
        }

        return result;
    }

    private createPayloadBuffer(): Buffer {
        const buffalo = new BuffaloZiGate(Buffer.alloc(250)); // hardcode @todo

        for (const parameter of this.parameters) {
            const value = this.payload[parameter.name];
            buffalo.write(ParameterType[parameter.parameterType], value, {});
        }
        return buffalo.getBuffer().slice(0, buffalo.getPosition());
    }

    /**
     * @todo
     */
    public isResetCommand(): boolean {
        return false;
    }
}

export default ZiGateObject;
