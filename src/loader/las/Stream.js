class Stream {
	constructor (buffer) {
		if (ArrayBuffer.isView(buffer)){
			this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
		}else{
			this.view = new DataView(buffer);
		}

		this.pos = 0;
	}

	seek (pos){
		this.pos = pos;
	}

	skip (l){
		let old = this.pos;
		this.pos += l;
		return old;
	}

	read (l){
		return new Uint8Array(this.view.buffer, this.view.byteOffset + this.skip(l), l);
	}

	readDoubleBE(){
		return this.view.getFloat64(this.skip(8), false);
	}

	readDoubleLE(){
		return this.view.getFloat64(this.skip(8), true);
	}

	readFloatBE(){
		return this.view.getFloat32(this.skip(4), false);
	}

	readFloatLE(){
		return this.view.getFloat32(this.skip(4), true);
	}

	readInt8 (){
		return this.view.getInt8(this.skip(1));
	}

	readInt16BE (){
		return this.view.getInt16(this.skip(2), false);
	}

	readInt16LE (){
		return this.view.getInt16(this.skip(2), true);
	}

	readInt32BE (){
		return this.view.getInt32(this.skip(4), false);
	}

	readInt32LE (){
		return this.view.getInt32(this.skip(4), true);
	}

	readInt64BE (){
		this.skip(8);
	}

	readInt64LE (){
		this.skip(8);
	}

	readUInt8 (){
		return this.view.getUint8(this.skip(1));
	}

	readUInt16BE (){
		return this.view.getUint16(this.skip(2), false);
	}

	readUInt16LE (){
		return this.view.getUint16(this.skip(2), true);
	}

	readUInt32BE (){
		return this.view.getUint32(this.skip(4), false);
	}

	readUInt32LE (){
		return this.view.getUint32(this.skip(4), true);
	}

	readUInt64BE (){
		this.skip(8);
	}

	readUInt64LE (){
		this.skip(8);
	}

	get remaining (){
		return this.view.byteLength - this.pos;
	}
}

export default Stream;