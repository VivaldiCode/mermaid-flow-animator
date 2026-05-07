declare module 'gif.js' {
  interface GIFOptions {
    workers?: number;
    workerScript?: string;
    quality?: number;
    width?: number;
    height?: number;
    background?: string;
    repeat?: number;
    transparent?: number | null;
    debug?: boolean;
    dither?: boolean | string;
  }

  interface FrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
  }

  type FrameInput =
    | CanvasRenderingContext2D
    | HTMLCanvasElement
    | HTMLImageElement
    | ImageData;

  class GIF {
    constructor(options?: GIFOptions);
    addFrame(image: FrameInput, options?: FrameOptions): void;
    on(event: 'finished', callback: (blob: Blob) => void): void;
    on(event: 'progress', callback: (progress: number) => void): void;
    on(event: 'abort', callback: () => void): void;
    on(event: 'start', callback: () => void): void;
    render(): void;
    abort(): void;
    running: boolean;
  }

  export default GIF;
}

declare module 'gif.js/dist/gif.worker.js?url' {
  const url: string;
  export default url;
}
