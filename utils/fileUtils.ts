
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // remove the header: 'data:image/png;base64,'
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const extractFramesFromVideo = (videoFile: File, frameCount: number): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const frames: string[] = [];
    const url = URL.createObjectURL(videoFile);

    video.src = url;
    video.muted = true;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.currentTime = 0;
    };

    let capturedFrames = 0;
    const captureFrame = () => {
      if (!ctx) {
        reject(new Error("Canvas context is not available"));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      frames.push(dataUrl.split(',')[1]); // remove header
      capturedFrames++;

      if (capturedFrames < frameCount) {
        const nextTime = (capturedFrames / frameCount) * video.duration;
        if (nextTime < video.duration) {
          video.currentTime = nextTime;
        } else {
          resolve(frames);
        }
      } else {
        resolve(frames);
      }
    };
    
    video.onseeked = () => {
       if (capturedFrames < frameCount) {
         captureFrame();
       }
    };
    
    video.oncanplay = () => {
        captureFrame();
    }

    video.onerror = (e) => {
        reject(new Error("Error loading video file for frame extraction."));
        URL.revokeObjectURL(url);
    }
  });
};
