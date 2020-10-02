import {ZiGateCommandCode, ZiGateMessageCode, ZiGateObjectPayload} from "./constants";


export interface PermitJoinPayload extends ZiGateObjectPayload {
    targetShortAddress: number
    interval: number
    TCsignificance?: number
}

export interface RawAPSDataRequestPayload extends ZiGateObjectPayload {
    addressMode: number
    targetShortAddress: number
    sourceEndpoint: number
    destinationEndpoint: number
    profileID: number
    clusterID: number
    securityMode: number
    radius: number
    dataLength: number
    data: any
}

export interface ZiGateCommandParameter {
    name: string;
    parameterType: string;
}

export interface ZiGateCommandType {
    request: ZiGateCommandParameter[];
    wait_status: boolean;
    wait_response: boolean | ZiGateMessageCode;
}

export const ZiGateCommand: { [key: string]: ZiGateCommandType } = {
    [ZiGateCommandCode.SetDeviceType]: {  // 0x0023
        request: [
            {name: 'deviceType', parameterType: 'UINT8'} //<device type: uint8_t>
        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.StartNetwork]: { // 0x0024
        request: [],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.StartNetworkScan]: {
        request: [],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.GetNetworkState]: { // 0x0009
        request: [],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.GetTimeServer]: { // 0x0017
        request: [],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.ErasePersistentData]: { // 0x0012
        request: [],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.Reset]: { // 0x0011
        request: [],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.SetTXpower]: { // SetTXpower
        request: [
            {name: 'value', parameterType: 'UINT8'}
        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.SetTXpower]: { // 0x004E
        request: [
            {name: 'targetAddress', parameterType: 'UINT16'}, //<Target Address : uint16_t>	Status
            {name: 'startIndex', parameterType: 'UINT8'}, //<Start Index : uint8_t>

        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.SetSecurityStateKey]: { // 0x0022
        request: [
            {name: 'keyType', parameterType: 'UINT8'}, // 	<key type: uint8_t>
            {name: 'key', parameterType: 'BUFFER'}, //   <key: data>

        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.GetVersion]: {
        request: [],
        wait_status: false,
        wait_response: ZiGateMessageCode.VersionList
    },
    [ZiGateCommandCode.RawMode]: {
        request: [
            {name: 'enabled', parameterType: 'INT8'},
        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.SetExtendedPANID]: {
        request: [
            {name: 'panId', parameterType: 'BUFFER'}, //<64-bit Extended PAN ID:uint64_t>
        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.SetChannelMask]: {
        request: [
            {name: 'channelMask', parameterType: 'UINT32'}, //<channel mask:uint32_t>
        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.RemoveDevice]: {
        request: [
            {name: 'targetShortAddress', parameterType: 'IEEEADDR'}, // <target short address: uint64_t>
            {name: 'extendedAddress:', parameterType: 'IEEEADDR'}, // <extended address: uint64_t>
        ],
        wait_status: false,
        wait_response: ZiGateMessageCode.LeaveIndication
    },
    [ZiGateCommandCode.PermitJoin]: {
        request: [
            {name: 'targetShortAddress', parameterType: 'UINT16'}, //<target short address: uint16_t> -
            // broadcast 0xfffc
            {name: 'interval', parameterType: 'UINT8'}, //<interval: uint8_t>
            // 0 = Disable Joining
            // 1 – 254 = Time in seconds to allow joins
            // 255 = Allow all joins
            // {name: 'TCsignificance', parameterType: 'UINT8'}, //<TCsignificance: uint8_t>
            // 0 = No change in authentication
            // 1 = Authentication policy as spec
        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.PermitJoinStatus]: {
        request: [
            {name: 'targetShortAddress', parameterType: 'UINT16'}, //<target short address: uint16_t> -
            // broadcast 0xfffc
            {name: 'interval', parameterType: 'UINT8'}, //<interval: uint8_t>
            // 0 = Disable Joining
            // 1 – 254 = Time in seconds to allow joins
            // 255 = Allow all joins
            {name: 'TCsignificance', parameterType: 'UINT8'}, //<TCsignificance: uint8_t>
            // 0 = No change in authentication
            // 1 = Authentication policy as spec
        ],
        wait_status: false,
        wait_response: ZiGateMessageCode.PermitJoinStatus
    },
    [ZiGateCommandCode.RawAPSDataRequest]: {
        request: [
            {name: 'addressMode', parameterType: 'UINT8'}, // <address mode: uint8_t>
            {name: 'targetShortAddress', parameterType: 'UINT16'}, // <target short address: uint16_t>
            {name: 'sourceEndpoint', parameterType: 'UINT8'}, // <source endpoint: uint8_t>
            {name: 'destinationEndpoint', parameterType: 'UINT8'}, // <destination endpoint: uint8_t>
            {name: 'profileID', parameterType: 'UINT16'}, // <profile ID: uint16_t>
            {name: 'clusterID', parameterType: 'UINT16'}, // <cluster ID: uint16_t>
            {name: 'securityMode', parameterType: 'UINT8'}, // <security mode: uint8_t>
            {name: 'radius', parameterType: 'UINT8'}, // <radius: uint8_t>
            {name: 'dataLength', parameterType: 'UINT8'}, // <data length: uint8_t>
            {name: 'data', parameterType: 'BUFFER'}, // <data: auint8_t>
        ],
        wait_status: false,
        wait_response: ZiGateMessageCode.APSDataConfirm
    },
    [ZiGateCommandCode.SimpleDescriptor]: {
        request: [
            {name: 'targetShortAddress', parameterType: 'UINT16'}, // <target short address: uint16_t>
            {name: 'endpoint', parameterType: 'UINT8'}, // <endpoint: uint8_t>
        ],
        wait_status: true,
        wait_response: false
    },
    [ZiGateCommandCode.ActiveEndpoint]: {
        request: [
            {name: 'targetShortAddress', parameterType: 'UINT16BE'}, // <target short address: uint16_t>
        ],
        wait_status: false,
        wait_response: true
    },
};
