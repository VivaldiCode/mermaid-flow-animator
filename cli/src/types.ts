export interface CliOptions {
  output: string;
  type: string;
  speed: string;
  duration: string;
  fps: string;
  width: string;
  height: string;
  scale: string;
  autoInterval: string;
  errorLoopLimit: string;
  badges: boolean;
  keepTemp?: boolean;
  quiet?: boolean;
}

export interface RenderInput {
  source: string;
  output: string;
  type: string;
  speed: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  scale: number;
  autoInterval: number;
  errorLoopLimit: number;
  badges: boolean;
  keepTemp: boolean;
  quiet: boolean;
}
