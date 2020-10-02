import {Buffalo, TsType as BuffaloTsType, TsType} from '../../../buffalo';
import {Options, Value} from "../../../buffalo/tstype";
import {IsNumberArray} from "../../../utils";

export interface BuffaloZiGateOptions extends BuffaloTsType.Options {
    startIndex?: number;
}

class BuffaloZiGate extends Buffalo {
    public write(type: string, value: Value, options: Options): void {
        if (type === 'RAW') {
            this.buffer.set(value, this.position);
            this.position++;
        } else if (type === 'UINT16BE') {
            this.buffer.writeUInt16BE(value, this.position);
            this.position += 2;
        } else if (type === 'UINT32BE') {
            this.buffer.writeUInt32BE(value, this.position);
            this.position += 4;
        } else if (type === 'ADDRESS_WITH_TYPE_DEPENDENCY') {
            const addressMode = this.buffer.readUInt8(this.position - 1);
            return addressMode == 3 ? this.writeIeeeAddr(value) : this.writeUInt16BE(value);
        } else if (type === 'BUFFER' && (Buffer.isBuffer(value) || IsNumberArray(value))) {
            this.writeBuffer(value, value.length);
        } else {
            super.write(type, value, options);
        }
    }

    public read(type: string, options: BuffaloZiGateOptions): TsType.Value {

        if (type === 'MACCAPABILITY') {
            const result: { [k: string]: boolean | number } = {};
            const mac = this.readUInt8();
            //
            result.alternatePanCoordinator = !!(mac.mac & 0b00000001);
            // bit 0: Alternative PAN Coordinator, always 0
            result.fullFunctionDevice = !!(mac.mac & 0b00000010);
            // bit 1: Device Type, 1 = FFD , 0 = RFD ; cf. https://fr.wikipedia.org/wiki/IEEE_802.15.4
            result.mainsPowerSource = !!(mac.mac & 0b00000100);
            // bit 2: Power Source, 1 = mains power, 0 = other
            result.receiverOnWhenIdle = !!(mac.mac & 0b00001000);
            // bit 3: Receiver on when Idle, 1 = non-sleepy, 0 = sleepy
            result.reserved = (mac.mac & 0b00110000) >> 4;
            // bit 4&5: Reserved
            result.securityCapability = !!(mac.mac & 0b01000000);
            // bit 6: Security capacity, always 0 (standard security)
            result.allocateAddress = !!(mac.mac & 0b10000000);
            // bit 7: 1 = joining device must be issued network address

            return result;
        } else if (type === 'UINT16BE') {
            return this.readUInt16BE();
        } else if (type === 'UINT32BE') {
            return this.readUInt32BE();
        } else if (type === 'ADDRESS_WITH_TYPE_DEPENDENCY') {
            // 		rep.addressSourceMode = Enum.ADDRESS_MODE(reader.nextUInt8());
            // 		rep.addressSource = rep.addressSourceMode.name === 'short' ?
            // 		reader.nextUInt16BE() : reader.nextBuffer(8).toString('hex');
            //
            const addressMode = this.buffer.readUInt8(this.position - 1);
            return addressMode == 3 ? this.readIeeeAddr() : this.readUInt16BE();
        } else if (type === 'BUFFER_RAW') {
            const buffer = this.buffer.slice(this.position);
            this.position += buffer.length;
            return buffer;
        } else {
            return super.read(type, options);
        }
    }


    public readUInt16BE(): Value {
        const value = this.buffer.readUInt16BE(this.position);
        this.position += 2;
        return value;
    }

    public readUInt32BE(): Value {
        const value = this.buffer.readUInt32BE(this.position);
        this.position += 4;
        return value;
    }

    public writeUInt16BE(value: number): void {
        this.buffer.writeUInt16BE(value, this.position);
        this.position += 2;
    }

    public writeUInt32BE(value: number): void {
        this.buffer.writeUInt32BE(value, this.position);
        this.position += 4;
    }

}

export default BuffaloZiGate;
