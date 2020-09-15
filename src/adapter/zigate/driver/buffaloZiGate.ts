import {Buffalo, TsType as BuffaloTsType, TsType} from '../../../buffalo';
import {Options, Value} from "../../../buffalo/tstype";
import ParameterType from "./parameterType";
import {Debug} from "../debug";

const debug = Debug('driver:bufaloZiGate');

export interface BuffaloZiGateOptions extends BuffaloTsType.Options {
    startIndex?: number;
}

class BuffaloZiGate extends Buffalo {
    public write(type: string, value: Value, options: Options): void {

        debug.log(type,value );
        if (type === ParameterType[ParameterType.MACCAPABILITY]) {

        }
        if (type === ParameterType[ParameterType.RAW]) {
            this.buffer.set(value, this.position)
            this.position++;
        } else if (type === ParameterType[ParameterType.ADDRESS_WITH_TYPE_DEPENDENCY]) {

        } else {
            super.write(type, value, options);
        }
    }

    public read(type: string, options: BuffaloZiGateOptions): TsType.Value {
        if (type === ParameterType[ParameterType.MACCAPABILITY]) {
            // rep.mac = reader.nextUInt8();
            //
            // rep.alternatePanCoordinator = !!(rep.mac & 0b00000001);
            // bit 0: Alternative PAN Coordinator, always 0
            // rep.fullFunctionDevice = !!(rep.mac &      0b00000010);
            // bit 1: Device Type, 1 = FFD , 0 = RFD ; cf. https://fr.wikipedia.org/wiki/IEEE_802.15.4
            // rep.mainsPowerSource = !!(rep.mac &        0b00000100);
            // bit 2: Power Source, 1 = mains power, 0 = other
            // rep.receiverOnWhenIdle = !!(rep.mac &      0b00001000);
            // bit 3: Receiver on when Idle, 1 = non-sleepy, 0 = sleepy
            // rep.reserved = (rep.mac &                  0b00110000) >> 4;
            // bit 4&5: Reserved
            // rep.securityCapability = !!(rep.mac &      0b01000000);
            // bit 6: Security capacity, always 0 (standard security)
            // rep.allocateAddress = !!(rep.mac &         0b10000000);
            // bit 7: 1 = joining device must be issued network address

            return this.readUInt8();
        } else if (type === ParameterType[ParameterType.ADDRESS_WITH_TYPE_DEPENDENCY]) {
            // 		rep.addressSourceMode = Enum.ADDRESS_MODE(reader.nextUInt8());
            // 		rep.addressSource = rep.addressSourceMode.name === 'short' ?
            // 		reader.nextUInt16BE() : reader.nextBuffer(8).toString('hex');

            return this.readUInt16();
        } else {
            return super.read(type, options);
        }
    }
}

export default BuffaloZiGate;
