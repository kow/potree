
export class WorkerPool{
	constructor(){
		this.workers = {};
	}

	getWorker(url){
		if (!this.workers[url]){
			this.workers[url] = [];
		}

		if (this.workers[url].length === 0){
			let worker = new Worker(url);
			this.workers[url].push(worker);
		}

		let worker = this.workers[url].pop();

		return worker;
	}

	job (url, ...args) {
		let worker = this.getWorker(url);

		return new Promise ((ok, err) => {
			worker.onmessage = msg => {
				this.returnWorker(url, worker);
				ok(msg);
			}

			worker.onerror = e => {
				this.returnWorker(url, worker);
				err(e);
			}

			worker.postMessage(...args);
		});
	}

	returnWorker(url, worker){
		this.workers[url].push(worker);
	}
};

//Potree.workerPool = new Potree.WorkerPool();
