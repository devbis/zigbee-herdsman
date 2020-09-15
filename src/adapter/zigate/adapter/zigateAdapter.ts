/* istanbul ignore file */
/* eslint-disable */
import * as TsType from '../../tstype';
import * as Events from '../../events';
import Adapter from '../../adapter';
import {Direction, FrameType, ZclFrame} from '../../../zcl';
import {Queue, Waitress} from '../../../utils';
import Driver from '../driver/zigate';
import {Debug} from "../debug";
import {BOOLEAN, ZiGateCommandCode} from "../driver/constants";

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
        this.driver = new Driver(serialPortOptions.path, serialPortOptions);
        // Обнуляем переменные
        this.waitress = new Waitress<Events.ZclDataPayload, WaitressMatcher>(
            this.waitressValidator, this.waitressTimeoutFormatter
        );

        // Подписка на события
        this.driver.on('receivedData', this.onRecievedData.bind(this));
    }

    /**
     * Adapter methods
     */
    public async start(): Promise<TsType.StartResult> {
        debug.log('start', arguments)
        // открываем адаптер, пробуем пингануть
        this.driver.open()
            .then(() => {
                debug.log("well connected to zigate key.", arguments);

                // @TODO получаем версию
                this.driver.sendCommand(ZiGateCommandCode.GetVersion, {});
                this.driver.sendCommand(ZiGateCommandCode.RawMode, {enabled: 0x01}); // Включаем raw mode
                // this.driver.sendCommand(ZiGateCommandCode.RawMode, {enabled: 0x00});
                this.driver.sendCommand(ZiGateCommandCode.PermitJoin, {
                    targetShortAddress: 0,
                    interval: 254,
                    TCsignificance: 0
                });
                this.driver.sendCommand(ZiGateCommandCode.PermitJoinStatus, {});
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


        // Делаем инициализацию ( вынести отдельный файл )
        // Time
        // Тип координатор
        // Network key
        // Channel list
        // Pan ID
        // Ext Pan Id

        // ?? Group ?
        // ?? Backup
        return 'restored'; // 'resumed' | 'reset' | 'restored'
    }

    public async stop(): Promise<void> {
        debug.log('stop', arguments)
        this.closing = true;
        await this.driver.close();
    }

    public async getCoordinator(): Promise<TsType.Coordinator> {
        debug.log('getCoordinator', arguments)

        const endpoints: any = [{
            ID: 0x01,
            profileID: 0x0104,
            deviceID: 0x0005,
            inputClusters: [0x0019, 0x000A],
            outputClusters: [0x0500]
        },
            {
                ID: 0xF2,
                profileID: 0xA1E0,
                deviceID: 0x0064,
                inputClusters: [],
                outputClusters: [0x0021]
            }];
        return {
            ieeeAddr: "null",
            networkAddress: 0,
            manufacturerID: 0x1135,
            endpoints,
        };

    };

    public getCoordinatorVersion(): Promise<TsType.CoordinatorVersion> {
        debug.log('getCoordinatorVersion', arguments)
        // return this.driver.version;
        return new Promise((resolve) => {
            resolve()
        })
    };

    public reset(type: 'soft' | 'hard'): Promise<void> {
        debug.log('reset', type, arguments)
        return
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
        return
    };

    /**
     * ZDO
     */
    public permitJoin(seconds: number, networkAddress: number): Promise<void> {
        return
        // return this.driver.sendCommand(ZiGateCommandCode.PermitJoin, {
        //     targetShortAddress: networkAddress ?? 0xFFFC,
        //     interval: seconds,
        //     TCsignificance: 0
        // });
    };

    public lqi(networkAddress: number): Promise<TsType.LQI> {
        debug.log('lqi', arguments)
        return
    };

    public routingTable(networkAddress: number): Promise<TsType.RoutingTable> {
        debug.log('RoutingTable', arguments)
        return
    };

    public nodeDescriptor(networkAddress: number): Promise<TsType.NodeDescriptor> {
        debug.log('nodeDescriptor', arguments)
        let res: TsType.NodeDescriptor = {
            manufacturerCode: 0,
            type: 'EndDevice',
        };
        return new Promise((resolve) => {
            resolve(res)
        });
    };

    public activeEndpoints(networkAddress: number): Promise<TsType.ActiveEndpoints> {
        debug.log('ActiveEndpoints', arguments)
        // let res: TsType.ActiveEndpoints = {
        //  endpoints: [
        //      1,
        //      2
        //  ]
        // };
        return new Promise((resolve) => {
            resolve()
        });
    };

    public simpleDescriptor(networkAddress: number, endpointID: number): Promise<TsType.SimpleDescriptor> {
        debug.log('SimpleDescriptor', arguments)
        // let res: TsType.SimpleDescriptor = {
        //     profileID: 1,
        //     endpointID: endpointID,
        //     deviceID: 1,
        //     inputClusters: [1],
        //     outputClusters: []
        // };
        return new Promise((resolve) => {
            resolve()
        });
    };

    public bind(
        destinationNetworkAddress: number, sourceIeeeAddress: string, sourceEndpoint: number,
        clusterID: number, destinationAddressOrGroup: string | number, type: 'endpoint' | 'group',
        destinationEndpoint?: number
    ): Promise<void> {
        debug.log('bind', arguments)
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
    public sendZclFrameToEndpoint(
        ieeeAddr: string, networkAddress: number, endpoint: number, zclFrame: ZclFrame, timeout: number,
        disableResponse: boolean, disableRecovery: boolean, sourceEndpoint?: number,
    ): Promise<Events.ZclDataPayload> {
        debug.log('sendZclFrameToEndpoint', arguments)
        return
    };

    public sendZclFrameToGroup(groupID: number, zclFrame: ZclFrame, sourceEndpoint?: number): Promise<void> {
        debug.log('sendZclFrameToGroup', arguments)
        return
    };

    public sendZclFrameToAll(endpoint: number, zclFrame: ZclFrame, sourceEndpoint: number): Promise<void> {
        // this.driver.sendCommand()
        debug.log('sendZclFrameToAll', arguments)
        return
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
