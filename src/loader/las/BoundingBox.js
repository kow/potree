class BoundingBox {
	constructor (min, max){
		this.min = min;
		this.max = max;
	}

	expand (x, y, z){
		if (this.min == null) this.min = [x, y, z];
		if (this.max == null) this.max = [x, y, z];

		if (this.min[0] > x) this.min[0] = x;
		if (this.max[0] < x) this.max[0] = x;
		if (this.min[1] > y) this.min[1] = y;
		if (this.max[1] < y) this.max[1] = y;
		if (this.min[2] > z) this.min[2] = z;
		if (this.max[2] < z) this.max[2] = z;
	}

	get center (){
		return [(this.min[0] + this.max[0]) / 2, (this.min[1] + this.max[1]) / 2, (this.min[2] + this.max[2]) / 2];
	}
}

export default BoundingBox;