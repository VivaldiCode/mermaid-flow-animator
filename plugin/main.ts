import { Plugin } from 'obsidian';
import { FlowAnimator } from './renderer';

const CODE_BLOCK_LANG = 'mermaid-flow';

export default class MermaidFlowPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerMarkdownCodeBlockProcessor(CODE_BLOCK_LANG, (source, el, ctx) => {
      const wrapper = el.createDiv({ cls: 'mermaid-flow-wrapper' });
      const animator = new FlowAnimator(wrapper, {
        source,
        speedMultiplier: 1,
        autoSpawn: true,
      });
      ctx.addChild(animator);
    });

    console.log('MermaidFlow Animator: plugin loaded');
  }

  onunload(): void {
    console.log('MermaidFlow Animator: plugin unloaded');
  }
}
