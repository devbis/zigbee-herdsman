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
    response: ZiGateResponseMatcher[];
}

export interface ZiGateResponseMatcherRule {
    receivedProperty: string;
    matcher: (expected: string | number | ZiGateMessageCode,
              received: string | number | ZiGateMessageCode) => boolean;
    expectedProperty?: string; // or
    value?: string | number | ZiGateMessageCode;

}

function equal(
    expected: string | number | ZiGateMessageCode,
    received: string | number | ZiGateMessageCode): boolean {

    return expected === received;
}

function notEqual(
    expected: string | number | ZiGateMessageCode,
    received: string | number | ZiGateMessageCode): boolean {

    return expected !== received;
}

export type ZiGateResponseMatcher = ZiGateResponseMatcherRule[];


export const ZiGateCommand: { [key: string]: ZiGateCommandType } = {
    [ZiGateCommandCode.SetDeviceType]: {  // 0x0023
        request: [
            {name: 'deviceType', parameterType: 'UINT8'} //<device type: uint8_t>
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.SetDeviceType}
            ]
        ]
    },
    [ZiGateCommandCode.StartNetwork]: { // 0x0024
        request: [],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.StartNetwork},
            ],
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.NetworkJoined}
            ],
        ]
    },
    [ZiGateCommandCode.StartNetworkScan]: {
        request: [],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.StartNetworkScan},
            ],
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.NetworkJoined}
            ]
        ]
    },
    [ZiGateCommandCode.GetNetworkState]: { // 0x0009
        request: [],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.GetNetworkState},
            ],

            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.NetworkState},
            ],
        ]
    },
    [ZiGateCommandCode.GetTimeServer]: { // 0x0017
        request: [],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.GetTimeServer},
            ]
        ]
    },
    [ZiGateCommandCode.ErasePersistentData]: { // 0x0012
        request: [],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.ErasePersistentData},
            ]
        ]
    },
    [ZiGateCommandCode.Reset]: { // 0x0011
        request: [],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.Reset},
            ]
        ]
    },
    [ZiGateCommandCode.SetTXpower]: { // SetTXpower
        request: [
            {name: 'value', parameterType: 'UINT8'}
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.SetTXpower},
            ]
        ]
    },
    [ZiGateCommandCode.ManagementLQI]: { // 0x004E
        request: [
            {name: 'targetAddress', parameterType: 'UINT16BE'}, //<Target Address : uint16_t>	Status
            {name: 'startIndex', parameterType: 'UINT8'}, //<Start Index : uint8_t>

        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.ManagementLQI},
            ],
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.ManagementLQIResponse},
            ],
        ]
    },
    [ZiGateCommandCode.SetSecurityStateKey]: { // 0x0022
        request: [
            {name: 'keyType', parameterType: 'UINT8'}, // 	<key type: uint8_t>
            {name: 'key', parameterType: 'DATA'}, //   <key: data>

        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.SetSecurityStateKey},
            ]
        ]
    },
    [ZiGateCommandCode.GetVersion]: {
        request: [],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.status', matcher: notEqual, value: 0},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.GetVersion},
            ],
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.VersionList}
            ],
        ]
    },
    [ZiGateCommandCode.RawMode]: {
        request: [
            {name: 'enabled', parameterType: 'INT8'},
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.RawMode},
            ]
        ]
    },
    [ZiGateCommandCode.SetExpendedPANID]: {
        request: [
            {name: 'panId', parameterType: 'IEEEADDR'}, //<64-bit Extended PAN ID:uint64_t>
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.SetExpendedPANID},
            ]
        ]
    },
    [ZiGateCommandCode.SetChannelMask]: {
        request: [
            {name: 'channelMask', parameterType: 'UINT32BE'}, //<channel mask:uint32_t>
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.SetChannelMask},
            ]
        ]
    },
    [ZiGateCommandCode.RemoveDevice]: {
        request: [
            {name: 'targetShortAddress', parameterType: 'UINT16BE'}, // <target short address: uint64_t>
            {name: 'extendedAddress:', parameterType: 'IEEEADDR'}, // <extended address: uint64_t>
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.status', matcher: notEqual, value: 0},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.RemoveDevice},
            ],
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.LeaveIndication}
            ],
        ]
    },
    [ZiGateCommandCode.PermitJoin]: {
        request: [
            {name: 'targetShortAddress', parameterType: 'UINT16BE'}, //<target short address: uint16_t> -
            // broadcast 0xfffc
            {name: 'interval', parameterType: 'UINT8'}, //<interval: uint8_t>
            // 0 = Disable Joining
            // 1 – 254 = Time in seconds to allow joins
            // 255 = Allow all joins
            // {name: 'TCsignificance', parameterType: 'UINT8'}, //<TCsignificance: uint8_t>
            // 0 = No change in authentication
            // 1 = Authentication policy as spec
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.PermitJoin},
            ]
        ]
    },
    [ZiGateCommandCode.PermitJoinStatus]: {
        request: [
            {name: 'targetShortAddress', parameterType: 'UINT16BE'}, //<target short address: uint16_t> -
            // broadcast 0xfffc
            {name: 'interval', parameterType: 'UINT8'}, //<interval: uint8_t>
            // 0 = Disable Joining
            // 1 – 254 = Time in seconds to allow joins
            // 255 = Allow all joins
            {name: 'TCsignificance', parameterType: 'UINT8'}, //<TCsignificance: uint8_t>
            // 0 = No change in authentication
            // 1 = Authentication policy as spec
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.status', matcher: notEqual, value: 0},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.PermitJoinStatus},
            ],
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.PermitJoinStatus}
            ],
        ]
    },
    [ZiGateCommandCode.RawAPSDataRequest]: {
        request: [
            {name: 'addressMode', parameterType: 'UINT8'}, // <address mode: uint8_t>
            {name: 'targetShortAddress', parameterType: 'UINT16BE'}, // <target short address: uint16_t>
            {name: 'sourceEndpoint', parameterType: 'UINT8'}, // <source endpoint: uint8_t>
            {name: 'destinationEndpoint', parameterType: 'UINT8'}, // <destination endpoint: uint8_t>
            {name: 'clusterID', parameterType: 'UINT16BE'}, // <cluster ID: uint16_t>
            {name: 'profileID', parameterType: 'UINT16BE'}, // <profile ID: uint16_t>
            {name: 'securityMode', parameterType: 'UINT8'}, // <security mode: uint8_t>
            {name: 'radius', parameterType: 'UINT8'}, // <radius: uint8_t>
            {name: 'dataLength', parameterType: 'UINT8'}, // <data length: uint8_t>
            {name: 'data', parameterType: 'BUFFER'}, // <data: auint8_t>
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.status', matcher: notEqual, value: 0},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.RawAPSDataRequest},
            ],
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.DataIndication},
                {
                    receivedProperty: 'payload.sourceAddress', matcher: equal,
                    expectedProperty: 'payload.targetShortAddress'
                },
                {
                    receivedProperty: 'payload.clusterID',
                    matcher: equal,
                    expectedProperty: 'payload.clusterID'
                },
                {
                    receivedProperty: 'payload.sourceEndpoint', matcher: equal,
                    expectedProperty: 'payload.destinationEndpoint'
                },
                {receivedProperty: 'payload.profileID', matcher: equal, expectedProperty: 'payload.profileID'},
            ],
        ]
    },
    [ZiGateCommandCode.SimpleDescriptor]: {
        request: [
            {name: 'targetShortAddress', parameterType: 'UINT16BE'}, // <target short address: uint16_t>
            {name: 'endpoint', parameterType: 'UINT8'}, // <endpoint: uint8_t>
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.status', matcher: notEqual, value: 0},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.SimpleDescriptor},
            ],
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.DataIndication},
                {
                    receivedProperty: 'payload.sourceAddress',
                    matcher: equal,
                    expectedProperty: 'payload.targetShortAddress'
                },
                {
                    receivedProperty: 'payload.clusterID',
                    matcher: equal, value: ZiGateMessageCode.SimpleDescriptorResponse
                }
            ],
        ]
    },
    [ZiGateCommandCode.ActiveEndpoint]: {
        request: [
            {name: 'targetShortAddress', parameterType: 'UINT16BE'}, // <target short address: uint16_t>
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.status', matcher: notEqual, value: 0},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.ActiveEndpoint},
            ],
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.DataIndication},
                {
                    receivedProperty: 'payload.sourceAddress',
                    matcher: equal,
                    expectedProperty: 'payload.targetShortAddress'
                },
                {receivedProperty: 'payload.clusterID', matcher: equal, value: ZiGateMessageCode.ActiveEndpointResponse}
            ],
        ]
    },
    [ZiGateCommandCode.NodeDescriptor]: {
        request: [
            {name: 'targetShortAddress', parameterType: 'UINT16BE'}, // <target short address: uint16_t>
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.status', matcher: notEqual, value: 0},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.NodeDescriptor},
            ],
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.DataIndication},
                {
                    receivedProperty: 'payload.sourceAddress',
                    matcher: equal,
                    expectedProperty: 'payload.targetShortAddress'
                },
                {receivedProperty: 'payload.clusterID', matcher: equal, value: 0x8002},
            ],
        ]
    },
    [ZiGateCommandCode.Bind]: {
        request: [
            {name: 'targetExtendedAddress', parameterType: 'IEEEADDR'}, // <target extended address: uint64_t>
            {name: 'targetEndpoint', parameterType: 'UINT8'}, // <target endpoint: uint8_t>
            {name: 'clusterID', parameterType: 'UINT16BE'}, // <cluster ID: uint16_t>
            {name: 'destinationAddressMode', parameterType: 'UINT8'}, // <destination address mode: uint8_t>
            {name: 'destinationAddress', parameterType: 'ADDRESS_WITH_TYPE_DEPENDENCY'}, // <destination address:uint16_t or uint64_t>
            {name: 'destinationEndpoint', parameterType: 'UINT8'}, // <destination endpoint (
            // value ignored for group address): uint8_t>
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.status', matcher: notEqual, value: 0},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.Bind},
            ],

        ]
    },
    [ZiGateCommandCode.UnBind]: {
        request: [
            {name: 'targetExtendedAddress', parameterType: 'IEEEADR'}, // <target extended address: uint64_t>
            {name: 'targetEndpoint', parameterType: 'UINT8'}, // <target endpoint: uint8_t>
            {name: 'clusterID', parameterType: 'UINT16BE'}, // <cluster ID: uint16_t>
            {name: 'destinationAddressMode', parameterType: 'UINT8'}, // <destination address mode: uint8_t>
            {name: 'destinationAddress', parameterType: 'ADDRESS_WITH_TYPE_DEPENDENCY'}, // <destination address:uint16_t or uint64_t>
            {name: 'destinationEndpoint', parameterType: 'UINT8'}, // <destination endpoint (
            // value ignored for group address): uint8_t>
        ],
        response: [
            [
                {receivedProperty: 'code', matcher: equal, value: ZiGateMessageCode.Status},
                {receivedProperty: 'payload.status', matcher: notEqual, value: 0},
                {receivedProperty: 'payload.packetType', matcher: equal, value: ZiGateCommandCode.UnBind},
            ],

        ]
    },
};
