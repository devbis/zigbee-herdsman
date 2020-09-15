import {ZiGateCommandCode, ZiGateMessageCode, ZiGateObjectPayload} from "./constants";
import ParameterType from "./parameterType";


export interface PermitJoinPayload extends ZiGateObjectPayload {
    targetShortAddress: number
    interval: number
    TCsignificance?: number
}

export interface ZiGateCommandParameter {
    name: string;
    parameterType: number;
}

export interface ZiGateCommandType {
    request: ZiGateCommandParameter[];
    wait_status: boolean;
    wait_response: false | ZiGateMessageCode
}

export const ZiGateCommand: { [key: string]: ZiGateCommandType } = {
    [ZiGateCommandCode.GetVersion]: {
        request: [],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.RawMode]: {
        request: [
            {name: 'enabled', parameterType: ParameterType.INT8},
        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.SetExpendedPANID]: {
        request: [
            {name: 'panId', parameterType: ParameterType.IEEEADDR}, //<64-bit Extended PAN ID:uint64_t>
        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.SetChannelMask]: {
        request: [
            {name: 'channelMask', parameterType: ParameterType.UINT32}, //<channel mask:uint32_t>
        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.RemoveDevice]: {
        request: [
            {name: 'targetShortAddress', parameterType: ParameterType.IEEEADDR}, // <target short address: uint64_t>
            {name: 'extendedAddress:', parameterType: ParameterType.IEEEADDR}, // <extended address: uint64_t>
        ],
        wait_status: true,
        wait_response: ZiGateMessageCode.LeaveIndication
    },
    [ZiGateCommandCode.PermitJoin]: {
        request: [
            {name: 'targetShortAddress', parameterType: ParameterType.UINT16}, //<target short address: uint16_t> -
            // broadcast 0xfffc
            {name: 'interval', parameterType: ParameterType.UINT8}, //<interval: uint8_t>
            // 0 = Disable Joining
            // 1 – 254 = Time in seconds to allow joins
            // 255 = Allow all joins
            // {name: 'TCsignificance', parameterType: ParameterType.UINT8}, //<TCsignificance: uint8_t>
            // 0 = No change in authentication
            // 1 = Authentication policy as spec
        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.PermitJoinStatus]: {
        request: [
            {name: 'targetShortAddress', parameterType: ParameterType.UINT16}, //<target short address: uint16_t> -
            // broadcast 0xfffc
            {name: 'interval', parameterType: ParameterType.UINT8}, //<interval: uint8_t>
            // 0 = Disable Joining
            // 1 – 254 = Time in seconds to allow joins
            // 255 = Allow all joins
            {name: 'TCsignificance', parameterType: ParameterType.UINT8}, //<TCsignificance: uint8_t>
            // 0 = No change in authentication
            // 1 = Authentication policy as spec
        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.RawAPSDataRequest]: {
        request: [
            {name: 'addressMode', parameterType: ParameterType.UINT8}, // <address mode: uint8_t>
            {name: 'targetShortAddress', parameterType: ParameterType.UINT16}, // <target short address: uint16_t>
            {name: 'sourceEndpoint', parameterType: ParameterType.UINT8}, // <source endpoint: uint8_t>
            {name: 'destinationEndpoint', parameterType: ParameterType.UINT8}, // <destination endpoint: uint8_t>
            {name: 'profileID', parameterType: ParameterType.UINT16}, // <profile ID: uint16_t>
            {name: 'clusterID', parameterType: ParameterType.UINT16}, // <cluster ID: uint16_t>
            {name: 'securityMode', parameterType: ParameterType.UINT8}, // <security mode: uint8_t>
            {name: 'radius', parameterType: ParameterType.UINT8}, // <radius: uint8_t>
            {name: 'dataLength', parameterType: ParameterType.UINT8}, // <data length: uint8_t>
            {name: 'data', parameterType: ParameterType.BUFFER}, // <data: auint8_t>
        ],
        wait_status: true,
        wait_response: false
    },
};
