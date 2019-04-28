const readString = bytes => {
	let s = "";

	for (let i = 0; i < bytes.length; i++){
		s += String.fromCharCode(bytes[i]);
	}

	return s;
}

export default record => record.recordID == 2111 && {
	decode: async (stream, length) => {
		record.projection = readString(stream.read(length));
	}
}