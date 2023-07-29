// pages/api/start-job.js
import Queue, { Job } from "bull";
import { Request, Response } from "express";
// Setup the job queue
const videoProcessingQueue = new Queue("video processing");
const logProgress = (job: Job, message: string, progress: number) => {
	job.progress({ message, progress }); // report progress
};
videoProcessingQueue.process(async (job, done) => {
	// Your video processing logic here
	// Example:
	console.log("job.data", job.data);

	try {
		//log progress every second

		logProgress(job, "Starting video processing", 0);
		for (let i = 0; i <= 100; i += 10) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			logProgress(job, `Processing step ${i}`, i);
		}
		console.log("job done");

		done(null, { message: "Video processed" });
	} catch (error: any) {
		console.log("error", error);

		done(error); // report failure
	}
});

export async function startJob(req: Request, res: Response) {
	const { redditAnswer } = await req.body;
	if (!redditAnswer) {
		return res.status(400).json({ message: "missing key ['redditAnswer']" });
	}

	const job = await videoProcessingQueue.add({
		redditAnswer,
	});

	return res.json({ jobId: job.id });
}

export async function getJobStatus(req: Request, res: Response) {
	const { jobId } = req.params;

	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");

	// Check if client is still connected
	req.on("close", () => {
		if (!res.writableEnded) {
			res.end();
			clearInterval(intervalId);
		}
	});

	const intervalId = setInterval(async () => {
		const job = await videoProcessingQueue.getJob(jobId);

		if (job === null || !res.writable) {
			// Job does not exist or client disconnected
			clearInterval(intervalId);
			if (!res.writableEnded) {
				res.write(
					`event: jobStatus\ndata: ${JSON.stringify({
						status: "Job not found",
					})}\n\n`
				);
				res.end();
			}
			return;
		}

		const jobState = await job.getState();
		const { progress, message } = job.progress();

		if (jobState === "completed" || jobState === "failed") {
			res.write(
				`event: jobStatus\ndata: ${JSON.stringify({
					status: jobState,
					progress,
					isFinished: true,
				})}\n\n`
			);
			clearInterval(intervalId);
			if (!res.writableEnded) {
				res.end();
			}
			if (jobState === "completed") {
				await job.remove();
			}
		} else {
			res.write(
				`event: jobStatus\ndata: ${JSON.stringify({
					status: message,
					progress,
				})}\n\n`
			);
		}
	}, 1000);
}