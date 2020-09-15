import {ZiGateMessageCode} from "./constants";
import ParameterType from "./parameterType";

export interface ZiGateMessageParameter {
    name: string;
    parameterType: number;
}

export interface ZiGateMessageType {
    response: ZiGateMessageParameter[];
}

export const ZiGateMessage: { [k: number]: ZiGateMessageType } = {
    [ZiGateMessageCode.DeviceAnnounce]: {
        response: [
            {name: 'shortAddress', parameterType: ParameterType.IEEEADDR},
            {name: 'ieee', parameterType: ParameterType.IEEEADDR},
            {name: 'MACcapability', parameterType: ParameterType.MACCAPABILITY},
            // MAC capability
            // Bit 0 – Alternate PAN Coordinator
            // Bit 1 – Device Type
            // Bit 2 – Power source
            // Bit 3 – Receiver On when Idle
            // Bit 4,5 – Reserved
            // Bit 6 – Security capability
            // Bit 7 – Allocate Address
            {name: 'rejoin', parameterType: ParameterType.UINT8},
        ]
    },
    [ZiGateMessageCode.Status]: {
        response: [
            {name: 'status', parameterType: ParameterType.UINT8}, // <status:uint8_t>
            // 0 = Success
            // 1 = Incorrect parameters
            // 2 = Unhandled command
            // 3 = Command failed
            // eslint-disable-next-line max-len
            // 4 = Busy (Node is carrying out a lengthy operation and is currently unable to handle the incoming command)
            // 5 = Stack already started (no new configuration accepted)
            // 128 – 244 = Failed (ZigBee event codes)
            // Packet Type: The value of the initiating command request.
            {name: 'sequence', parameterType: ParameterType.UINT8}, // <sequence number: uint8_t>
            {name: 'packetType', parameterType: ParameterType.UINT16}, // <Packet Type: uint16_t>
        ]
    },
    [ZiGateMessageCode.PermitJoinStatus]: {
        response: [
            {name: 'status', parameterType: ParameterType.UINT8}, // <status:uint8_t>
        ]
    },
    [ZiGateMessageCode.DataIndication]: {
        response: [
            {name: 'status', parameterType: ParameterType.UINT8}, // <status: uint8_t>
            {name: 'profileID', parameterType: ParameterType.UINT16}, // <Profile ID: uint16_t>
            {name: 'clusterID', parameterType: ParameterType.UINT16}, // <cluster ID: uint16_t>
            {name: 'sourceEndpoint', parameterType: ParameterType.UINT8}, // <source endpoint: uint8_t>
            {name: 'destinationEndpoint', parameterType: ParameterType.UINT8}, // <destination endpoint: uint8_t>
            {name: 'sourceAddressMode', parameterType: ParameterType.UINT8}, // <source address mode: uint8_t>
            // {name: 'sourceAddress', parameterType: ParameterType.ADDRESS_WITH_TYPE_DEPENDENCY},
            // // <source address: uint16_t or uint64_t>
            // {name: 'destinationAddressMode', parameterType: ParameterType.UINT8},
            // // <destination address mode: uint8_t>
            // {name: 'destinationAddress', parameterType: ParameterType.ADDRESS_WITH_TYPE_DEPENDENCY},
            // // <destination address: uint16_t or uint64_t>
            // {name: 'payloadSize', parameterType: ParameterType.UINT8}, // <payload size : uint8_t>
            // {name: 'payload', parameterType: ParameterType.LIST_UINT8}, // <payload : data each element is uint8_t>
        ]
    },
    [ZiGateMessageCode.APSDataConfirm]: {
        response: [
            {name: 'status', parameterType: ParameterType.UINT8}, // <status: uint8_t>
            {name: 'sourceEndpoint', parameterType: ParameterType.UINT8}, // <source endpoint: uint8_t>
            {name: 'destinationEndpoint', parameterType: ParameterType.UINT8}, // <destination endpoint: uint8_t>
            // {name: 'destinationAddressMode', parameterType: ParameterType.UINT8},
            // // <destination address mode: uint8_t>
            // {name: 'destinationAddress', parameterType: ParameterType.ADDRESS_WITH_TYPE_DEPENDENCY},
            // // <destination address: uint16_t or uint64_t>
            // {name: 'seqNumber', parameterType: ParameterType.UINT8}, // <seq number: uint8_t>
        ]
    },
    [ZiGateMessageCode.NetworkStateResponse]: {
        response: [
            {name: 'shortAddress', parameterType: ParameterType.UINT16}, // <Short Address: uint16_t>
            {name: 'extendedAddress', parameterType: ParameterType.IEEEADDR}, // <Extended Address: uint64_t>
            {name: 'PANID', parameterType: ParameterType.UINT16}, // <PAN ID: uint16_t>
            {name: 'ExtPANID', parameterType: ParameterType.IEEEADDR}, // <Ext PAN ID: uint64_t>
            {name: 'Channel', parameterType: ParameterType.UINT8}, // <Channel: uint8_t>
        ]
    },
    [ZiGateMessageCode.VersionList]: {
        response: [
            {name: 'majorVersion', parameterType: ParameterType.UINT16}, // <Major version number: uint16_t>
            {name: 'installerVersion', parameterType: ParameterType.UINT16}, // <Installer version number: uint16_t>
        ]
    },
    [ZiGateMessageCode.NetworkJoined]: {
        response: [
            {name: 'status', parameterType: ParameterType.UINT8}, // <status: uint8_t>
            // Status:
            // 0 = Joined existing network
            // 1 = Formed new network
            // 128 – 244 = Failed (ZigBee event codes)
            {name: 'shortAddress', parameterType: ParameterType.UINT16}, // <short address: uint16_t>
            {name: 'extendedAddress', parameterType: ParameterType.IEEEADDR}, // <extended address:uint64_t>
            {name: 'channel', parameterType: ParameterType.UINT8}, // <channel: uint8_t>
        ]
    },
    [ZiGateMessageCode.LeaveIndication]: {
        response: [
            {name: 'extendedAddress', parameterType: ParameterType.IEEEADDR}, // <extended address: uint64_t>
            {name: 'rejoin', parameterType: ParameterType.UINT8}, // <rejoin status: uint8_t>
        ]
    },
    [ZiGateMessageCode.RouterDiscoveryConfirm]: {
        response: [
            {name: 'status', parameterType: ParameterType.UINT8}, // <status: uint8_t>
            {name: 'nwkStatus', parameterType: ParameterType.UINT8}, // <nwk status: uint8_t>
        ]
    },
    [ZiGateMessageCode.APSDataConfirmFail]: {
        response: [
            {name: 'status', parameterType: ParameterType.UINT8}, // <status: uint8_t>
            {name: 'sourceEndpoint', parameterType: ParameterType.UINT8}, // <src endpoint: uint8_t>
            {name: 'destinationEndpoint', parameterType: ParameterType.UINT8}, // <dst endpoint: uint8_t>
            {name: 'destinationAddressMode', parameterType: ParameterType.UINT8}, // <dst address mode: uint8_t>
            {name: 'destinationAddress', parameterType: ParameterType.ADDRESS_WITH_TYPE_DEPENDENCY},
            // <destination address: uint64_t>
            {name: 'seqNumber', parameterType: ParameterType.UINT8}, // <seq number: uint8_t>
        ]
    },
};
