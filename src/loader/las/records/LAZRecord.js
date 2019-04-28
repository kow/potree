export default record => record.recordID == 22204 && record.userID == 'laszip encoded' && {
	decode: async (stream, length) => {
		record.compressor = stream.readUInt16LE();
		record.coder = stream.readUInt16LE();

		record.version = {
			major: stream.readUInt8(),
			minor: stream.readUInt8(),
			revision: stream.readUInt16LE()
		}

		record.options = stream.readUInt32LE();
		record.chunkSize = stream.readUInt32LE();
		record.numPoints = stream.readUInt64LE();
		record.numBytes = stream.readUInt64LE();

		let itemsCount = stream.readUInt16LE();
		record.items = [];

		//console.log(itemsCount, record.numPoints)

		for (let i = 0; i < itemsCount; i++){
			record.items.push({
				type: stream.readUInt16LE(),
				chunkSize: stream.readUInt16LE(),
				version: stream.readUInt16LE()
			})
		}
	}
}