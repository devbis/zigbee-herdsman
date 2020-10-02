/* istanbul ignore file */
/* eslint-disable */
import * as TsType from '../../tstype';
import {DeviceType} from '../../tstype';
import * as Events from '../../events';
import Adapter from '../../adapter';
import {Direction, FrameType, ZclFrame} from '../../../zcl';
import {Queue, Waitress} from '../../../utils';
import Driver from '../driver/zigate';
import {Debug} from "../debug";
import {ZiGateCommandCode} from "../driver/constants";
import {RawAPSDataRequestPayload} from "../driver/commandType";
import ZiGateObject from "../driver/ziGateObject";

const debug = Debug('adapter');

interface WaitressMatcher {
    address: number | string;
    endpoint: number;
    transactionSequenceNumber?: number;
    frameType: FrameType;
    clusterID: number;
    commandIdentifier: number;
    direction: number;
}

const channelsToMask = (channels: number[]): number =>
    channels.map((x) => 2 ** x).reduce(
        (acc, x) => acc + x, 0);


class ZiGateAdapter extends Adapter {
    private driver: Driver;
    private queue: Queue;
    private transactionID: number;
    private joinPermitted: boolean;
    private fwVersion: TsType.CoordinatorVersion;
    private waitress: Waitress<Events.ZclDataPayload, WaitressMatcher>;
    private closing: boolean;

    public constructor(networkOptions: TsType.NetworkOptions,
                       serialPortOptions: TsType.SerialPortOptions,
                       backupPath: string,
                       adapterOptions: TsType.AdapterOptions
    ) {

        super(networkOptions, serialPortOptions, backupPath, adapterOptions);

        debug.log('construct', arguments);

        this.joinPermitted = false;
        this.driver = new Driver(serialPortOptions.path, serialPortOptions);
        // Подписка на события
        // Обнуляем переменные
        this.waitress = new Waitress<Events.ZclDataPayload, WaitressMatcher>(
            this.waitressValidator, this.waitressTimeoutFormatter
        );

        this.driver.on('received', (data: any) => {
            if (data.zclFrame instanceof ZclFrame) {
                const payload: Events.ZclDataPayload = {
                    address: data.ziGateObject.payload.sourceAddress,
                    frame: data.zclFrame,
                    endpoint: data.ziGateObject.payload.sourceEndpoint,
                    linkquality: data.ziGateObject.frame.readRSSI(),
                    groupID: 0,
                };
                this.emit(Events.Events.zclData, payload)
            } else {
                debug.info('msg not zclFrame')
                // пока убрал тк начинало опрашивать 0 endpoint

                // const payload: Events.RawDataPayload = {
                //     address: data.ziGateObject.payload.sourceAddress,
                //     clusterID: data.ziGateObject.payload.clusterID,
                //     data: data.ziGateObject.payload.payload,
                //     endpoint: data.ziGateObject.payload.sourceEndpoint,
                //     linkquality: data.ziGateObject.frame.readRSSI(),
                //     groupID: 0,
                // };
                // this.emit(Events.Events.rawData, payload)
            }
        });

        this.driver.on('receivedRaw', (data: any) => {
            debug.error(data);
        });

        this.driver.on('LeaveIndication', (data: any) => {
            debug.log(data);
            const payload: Events.DeviceLeavePayload = {
                networkAddress: data.ziGateObject.payload.extendedAddress,
                ieeeAddr: data.ziGateObject.payload.extendedAddress
            };
            this.emit(Events.Events.deviceLeave, payload)
        });

        this.driver.on('DeviceAnnounce', (data: any) => {
            const payload: Events.DeviceAnnouncePayload = {
                networkAddress: data.ziGateObject.payload.shortAddress,
                ieeeAddr: data.ziGateObject.payload.ieee
            };
            debug.log(data.ziGateObject.payload);
            debug.log(payload);
            debug.log(this.joinPermitted);
            if (this.joinPermitted === true) {
                this.emit(Events.Events.deviceJoined, payload)
            } else {
                this.emit(Events.Events.deviceAnnounce, payload)
            }
        });

    }

    /**
     * Adapter methods
     */
    public async start(): Promise<TsType.StartResult> {
        debug.log('start', arguments)
        // открываем адаптер, пробуем пингануть
        await this.driver.open()
            .then(() => {
                debug.log("well connected to zigate key.", arguments);

                return this.driver.sendCommand(ZiGateCommandCode.Reset, {});

            })
            .then(async () => {

                //
                await this.driver.sendCommand(ZiGateCommandCode.PermitJoin, {
                    targetShortAddress: 0,
                    interval: 254,
                    TCsignificance: 0
                });
                await this.driver.sendCommand(ZiGateCommandCode.RawMode, {enabled: 0x01}); // Включаем raw mode
                // await this.driver.sendCommand(ZiGateCommandCode.RawMode, {enabled: 0x02}); //  raw hybrid mode
                this.driver.sendCommand(ZiGateCommandCode.SetDeviceType, {deviceType: 0});


                // @ts-ignore
                await this.driver.sendCommand(
                    ZiGateCommandCode.SetChannelMask,
                    {channelMask: channelsToMask(this.networkOptions.channelList)},
                );

                await this.driver.sendCommand(ZiGateCommandCode.StartNetwork, {});
                // await this.driver.sendCommand(ZiGateCommandCode.StartNetworkScan, {});

                await this.driver.sendCommand(ZiGateCommandCode.GetNetworkState, {});

            })
            .catch((error: string) => {
                debug.error("dont connected to zigate key");
                debug.error(error);
            });

        // Выставляем настройки конкуренции в очереди
        const concurrent = this.adapterOptions && this.adapterOptions.concurrent ?
            this.adapterOptions.concurrent : (1);
        debug.log(`Adapter concurrent: ${concurrent}`);
        this.queue = new Queue(concurrent);
        debug.log(`Detected zigate version '${this.fwVersion}' (${JSON.stringify(this.fwVersion)})`);


        return 'restored'; // 'resumed' | 'reset' | 'restored'
    }

    public async stop(): Promise<void> {
        debug.log('stop', arguments)
        this.closing = true;
        await this.driver.close();
    }

    public async getCoordinator(): Promise<TsType.Coordinator> {
        debug.log('getCoordinator', arguments)
        // const networkResponse: any = await this.driver.sendCommand(ZiGateCommandCode.StartNetwork);

        const endpoints: any = [
            {
                ID: 0x01,
                profileID: 0x0104,
                deviceID: 0x0840,
                inputClusters: [
                    0x0000,
                    0x0003,
                    0x0019,
                    0x0204,
                    0x000F,
                ],
                outputClusters: [
                    0x0B03,
                    0x0000,
                    0x0300,
                    0x0004,
                    0x0003,
                    0x0008,
                    0x0006,
                    0x0005,
                    0x0101,
                    0x0702,
                    0x0500,
                    0x0019,
                    0x0201,
                    0x0401,
                    0x0400,
                    0x0406,
                    0x0403,
                    0x0405,
                    0x0402,
                    0x0204,
                    0x0001,
                    0x0B05,
                    0x1000
                ]
            },
            {
                ID: 0x0A,
                profileID: 0x0104,
                deviceID: 0x0840,
                inputClusters: [
                    0x0000,
                    0x0003,
                    0x0019,
                    0x0204,
                    0x000F,
                ],
                outputClusters: [
                    0x0B03,
                    0x0000,
                    0x0300,
                    0x0004,
                    0x0003,
                    0x0008,
                    0x0006,
                    0x0005,
                    0x0101,
                    0x0702,
                    0x0500,
                    0x0019,
                    0x0201,
                    0x0401,
                    0x0400,
                    0x0406,
                    0x0403,
                    0x0405,
                    0x0402,
                    0x0204,
                    0x0001,
                    0x0B05,
                    0x1000
                ]
            }];
        return {
            ieeeAddr: '',//networkResponse.extendedAddress,
            networkAddress: 0,//networkResponse.shortAddress,
            manufacturerID: 0,
            endpoints,
        };

    };

    public async getCoordinatorVersion(): Promise<TsType.CoordinatorVersion> {
        debug.log('getCoordinatorVersion', arguments)
        // @ts-ignore
        const result: ZiGateObject = await this.driver.sendCommand(ZiGateCommandCode.GetVersion, {});
        const version: TsType.CoordinatorVersion = {
            type: 'zigate',
            meta: {'major': result.payload.installerVersion.toString()}
        };
        return new Promise((resolve) => {
            resolve(version)
        })
    };

    public async reset(type: 'soft' | 'hard'): Promise<void> {
        debug.log('reset', type, arguments)

        if (type === 'soft') {
            await this.driver.sendCommand(ZiGateCommandCode.Reset, {});
            return;
        } else if (type === 'hard') {
            await this.driver.sendCommand(ZiGateCommandCode.ErasePersistentData, {});
            await this.driver.sendCommand(ZiGateCommandCode.Reset, {});
            return;
        }
    };

    public supportsLED(): Promise<boolean> {
        debug.log('supportsLED', arguments)
        return Promise.reject();
    };

    public setLED(enabled: boolean): Promise<void> {
        debug.log('setLED', arguments)
        return
    };

    /**
     * https://zigate.fr/documentation/deplacer-le-pdm-de-la-zigate/
     * pdm from host
     */
    public async supportsBackup(): Promise<boolean> {
        return false;
    };

    public async backup(): Promise<TsType.Backup> {
        return Promise.reject();
    };

    public getNetworkParameters(): Promise<TsType.NetworkParameters> {
        debug.log('getNetworkParameters', arguments)
        return
    };

    public setTransmitPower(value: number): Promise<void> {
        debug.log('setTransmitPower', arguments)
        // this.driver.sendCommand(0x0806, {value: value});
        return
    };

    /**
     * ZDO
     */
    public async permitJoin(seconds: number, networkAddress: number): Promise<void> {

        this.driver.sendCommand(ZiGateCommandCode.PermitJoin, {
            targetShortAddress: networkAddress || 0,
            interval: seconds,
            TCsignificance: 0
        });

        if (seconds === 0) {
            this.joinPermitted = false;
        } else {
            this.joinPermitted = true;
        }
        await this.driver.sendCommand(ZiGateCommandCode.PermitJoinStatus, {});

    };

    public lqi(networkAddress: number): Promise<TsType.LQI> {
        debug.log('lqi', arguments)
        this.driver.sendCommand(0x004E, {targetAddress: networkAddress, startIndex: 0});
        return
    };

    public routingTable(networkAddress: number): Promise<TsType.RoutingTable> {
        debug.log('RoutingTable', arguments)
        return
    };

    public async nodeDescriptor(networkAddress: number): Promise<TsType.NodeDescriptor> {


        debug.log('nodeDescriptor', arguments)
        const payload = {
            targetShortAddress: networkAddress
        }
        debug.log('nodeDescriptor', payload)

        try {
            const result = await this.driver.sendCommand(ZiGateCommandCode.NodeDescriptor, payload);

            // @ts-ignore
            if(result.code === 0x8000 && result.payload.status >0 )
                // @ts-ignore
                throw new Error('nodeDescriptor error ' + result.payload.status)

            debug.error(result);


            // @ts-ignore
            const data = result.payload.payload;
            const buf = data;
            const logicaltype = (data[4] & 7);
            const type: DeviceType = (logicaltype === 1) ? 'Router' : (logicaltype === 2) ? 'EndDevice' : (logicaltype === 0) ? 'Coordinator' : 'Unknown';
            const manufacturer = buf.readUInt16LE(7);

            debug.log("RECEIVING NODE_DESCRIPTOR - addr: 0x" + networkAddress.toString(16) + " type: " + type + " manufacturer: 0x" + manufacturer.toString(16));
            return {manufacturerCode: manufacturer, type};
        } catch (error) {
            debug.error("RECEIVING NODE_DESCRIPTOR FAILED - addr: 0x" + networkAddress.toString(16) + " " + error);
            return Promise.reject();
        }
    };

    public async activeEndpoints(networkAddress: number): Promise<TsType.ActiveEndpoints> {
        debug.log('ActiveEndpoints', arguments)
        const payload = {
            targetShortAddress: networkAddress
        }
        debug.log('ActiveEndpoints', payload)

        try {
            const result = await this.driver.sendCommand(ZiGateCommandCode.ActiveEndpoint, payload);

            // @ts-ignore
            if (result.code === 0x8000 && result.payload.status > 0)
                // @ts-ignore
                throw new Error('activeEndpoints error ' + result.payload.status)

            debug.error(result);

            // @ts-ignore
            const zclFrame = ZiGateObject.fromBufer(0x8005, result.payload.payload);
            debug.error(zclFrame);
            const payloadAE: TsType.ActiveEndpoints = {
                // @ts-ignore
                endpoints: zclFrame.payload.endpoints
            }

            debug.log(payloadAE);
            return payloadAE;

        } catch (error) {
            debug.error("RECEIVING ActiveEndpoints FAILED" + error);
            return Promise.reject();
        }
    };

    public async simpleDescriptor(networkAddress: number, endpointID: number): Promise<TsType.SimpleDescriptor> {
        debug.log('SimpleDescriptor', arguments)

        try {

            const payload = {
                targetShortAddress: networkAddress,
                endpoint: endpointID
            }
            debug.log('SimpleDescriptor', payload)
            const result = await this.driver.sendCommand(ZiGateCommandCode.SimpleDescriptor, payload);

            // @ts-ignore
            if (result.code === 0x8000 && result.payload.status > 0)
                // @ts-ignore
                throw new Error('activeEndpoints error ' + result.payload.status)

            // @ts-ignore
            const buf = result.payload.payload;

            if (buf.length > 11) {

                const inCount = buf.readUInt8(11);
                const inClusters = [];
                let cIndex = 12;
                for (let i = 0; i < inCount; i++) {
                    inClusters[i] = buf.readUInt16LE(cIndex);
                    cIndex += 2;
                }
                const outCount = buf.readUInt8(12 + (inCount * 2));
                const outClusters = [];
                cIndex = 13 + (inCount * 2);
                for (let l = 0; l < outCount; l++) {
                    outClusters[l] = buf.readUInt16LE(cIndex);
                    cIndex += 2;
                }


                const resultPayload: TsType.SimpleDescriptor = {
                    profileID: buf.readUInt16LE(6),
                    endpointID: buf.readUInt8(5),
                    deviceID: buf.readUInt16LE(8),
                    inputClusters: inClusters,
                    outputClusters: outClusters
                }

                debug.log(resultPayload);
                return resultPayload;
            }
        } catch (error) {
            debug.error("RECEIVING SIMPLE_DESCRIPTOR FAILED - addr: 0x" + networkAddress.toString(16) + " EP:" + endpointID + " " + error);
            return Promise.reject();
        }
    };

    public bind(
        destinationNetworkAddress: number, sourceIeeeAddress: string, sourceEndpoint: number,
        clusterID: number, destinationAddressOrGroup: string | number, type: 'endpoint' | 'group',
        destinationEndpoint?: number
    ): Promise<void> {

        let payload = {
            targetExtendedAddress: sourceIeeeAddress,
            targetEndpoint: sourceEndpoint,
            clusterID: clusterID,
            destinationAddressMode: (type === 'group') ? 0x01 : 0x03,
            destinationAddress: destinationNetworkAddress,
        };

        if (typeof destinationEndpoint !== undefined) {
            // @ts-ignore
            payload['destinationEndpoint'] = destinationEndpoint
        }
        const result = this.driver.sendCommand(ZiGateCommandCode.Bind, payload);

        return
    };

    public unbind(
        destinationNetworkAddress: number, sourceIeeeAddress: string, sourceEndpoint: number,
        clusterID: number, destinationAddressOrGroup: string | number, type: 'endpoint' | 'group',
        destinationEndpoint: number
    ): Promise<void> {
        debug.log('unbind', arguments)
        return
    };

    public removeDevice(networkAddress: number, ieeeAddr: string): Promise<void> {
        debug.log('removeDevice', arguments)
        return
    };

    /**
     * ZCL
     */
    public async sendZclFrameToEndpoint(
        ieeeAddr: string, networkAddress: number, endpoint: number, zclFrame: ZclFrame, timeout: number,
        disableResponse: boolean, disableRecovery: boolean, sourceEndpoint?: number,
    ): Promise<Events.ZclDataPayload> {
        debug.log('sendZclFrameToEndpoint', arguments)
        // @ts-ignore
        let pay = zclFrame.toBuffer();


        // @ts-ignore
        const payload: RawAPSDataRequestPayload = {
            addressMode: 0x02, //nwk
            targetShortAddress: networkAddress,
            sourceEndpoint: sourceEndpoint || 0x01,
            destinationEndpoint: endpoint,
            profileID: 0x0104,
            clusterID: zclFrame.Cluster.ID,
            securityMode: 0x02,
            radius: 30,
            dataLength: pay.length,
            data: [...pay],
        }
        debug.log('sendZclFrameToEndpoint', payload)

        try {
            const result = await this.driver.sendCommand(ZiGateCommandCode.RawAPSDataRequest, payload);

            // @ts-ignore
            if (result.code === 0x8000 && result.payload.status > 0)
                // @ts-ignore
                throw new Error('sendZclFrameToEndpoint error ' + result.payload.status)


            const resultPayload: Events.ZclDataPayload = {
                // @ts-ignore
                address: result.payload.sourceAddress,
                // @ts-ignore
                frame: result.payload.payload,
                // @ts-ignore
                endpoint: result.payload.sourceEndpoint,
                // @ts-ignore
                linkquality: result.frame.readRSSI(),
                groupID: 0
            }
            return resultPayload;
        } catch (e) {
            return Promise.reject(e);
        }

    };

    public sendZclFrameToGroup(groupID: number, zclFrame: ZclFrame, sourceEndpoint?: number): Promise<void> {
        debug.log('sendZclFrameToGroup', arguments)
        return
    };

    public sendZclFrameToAll(endpoint: number, zclFrame: ZclFrame, sourceEndpoint: number): Promise<void> {
        // debug.log('sendZclFrameToAll', arguments)
        // @ts-ignore
        let pay = zclFrame.toBuffer();

        if(sourceEndpoint !== 0x01 &&sourceEndpoint !== 0x0A)
            return;
        // @ts-ignore
        const payload: RawAPSDataRequestPayload = {
            addressMode: 2, //nwk
            targetShortAddress: 0,
            sourceEndpoint: sourceEndpoint,
            destinationEndpoint: endpoint,
            profileID: 0x0104,
            clusterID: zclFrame.Cluster.ID,
            securityMode: 0,
            radius: 0,
            dataLength: pay.length,
            data: pay,
        }
        debug.log('sendZclFrameToAll', payload)

        // @ts-ignore
        return this.driver.sendCommand(ZiGateCommandCode.RawAPSDataRequest, payload);
    };

    /**
     * InterPAN
     */
    public setChannelInterPAN(channel: number): Promise<void> {
        debug.log('setChannelInterPAN', arguments)
        return
    };

    public sendZclFrameInterPANToIeeeAddr(zclFrame: ZclFrame, ieeeAddress: string): Promise<void> {
        debug.log('sendZclFrameInterPANToIeeeAddr', arguments)
        return
    };

    public sendZclFrameInterPANBroadcast(
        zclFrame: ZclFrame, timeout: number
    ): Promise<Events.ZclDataPayload> {
        debug.log('sendZclFrameInterPANBroadcast', arguments)
        return
    };

    public restoreChannelInterPAN(): Promise<void> {
        debug.log('restoreChannelInterPAN', arguments)
        return
    };


    public waitFor(
        networkAddress: number, endpoint: number, frameType: FrameType, direction: Direction,
        transactionSequenceNumber: number, clusterID: number, commandIdentifier: number, timeout: number,
    ): { promise: Promise<Events.ZclDataPayload>; cancel: () => void } {
        debug.log('waitFor', arguments)
        const payload = {
            address: networkAddress, endpoint, clusterID, commandIdentifier, frameType, direction,
            transactionSequenceNumber,
        };
        const waiter = this.waitress.waitFor(payload, timeout);
        const cancel = (): void => this.waitress.remove(waiter.ID);
        return {promise: waiter.start().promise, cancel};
    };

    private waitressTimeoutFormatter(matcher: WaitressMatcher, timeout: number): string {
        debug.log('waitressTimeoutFormatter', arguments)
        return `Timeout - ${matcher.address} - ${matcher.endpoint}` +
            ` - ${matcher.transactionSequenceNumber} - ${matcher.clusterID}` +
            ` - ${matcher.commandIdentifier} after ${timeout}ms`;
    }

    private waitressValidator(payload: Events.ZclDataPayload, matcher: WaitressMatcher): boolean {
        debug.log('waitressValidator', arguments)
        const transactionSequenceNumber = payload.frame.Header.transactionSequenceNumber;
        return (!matcher.address || payload.address === matcher.address) &&
            payload.endpoint === matcher.endpoint &&
            (!matcher.transactionSequenceNumber || transactionSequenceNumber === matcher.transactionSequenceNumber) &&
            payload.frame.Cluster.ID === matcher.clusterID &&
            matcher.frameType === payload.frame.Header.frameControl.frameType &&
            matcher.commandIdentifier === payload.frame.Header.commandIdentifier &&
            matcher.direction === payload.frame.Header.frameControl.direction;
    }

    public static async isValidPath(path: string): Promise<boolean> {
        return Driver.isValidPath(path);
    }

    public static async autoDetectPath(): Promise<string> {
        return Driver.autoDetectPath();
    }

    private onRecievedData(data: any): void {
        debug.log(data);

    }
}


export default ZiGateAdapter;
