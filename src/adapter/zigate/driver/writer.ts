import * as stream from 'stream';
import Frame from './frame';
import {Debug} from '../debug';

const debug = Debug('driver:writer');

class Writer extends stream.Readable {
    public writeFrame(frame: Frame): void {
        const buffer = frame.toBuffer();
        debug.log(`--> frame [${[...buffer]}]`);
        this.push(buffer);
    }

    public writeBuffer(buffer: Buffer): void {
        debug.log(`--> buffer [${[...buffer]}]`);
        this.push(buffer);
    }
}

export default Writer;
