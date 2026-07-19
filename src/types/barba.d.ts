declare module '@barba/core' {
  export interface BarbaPageInfo {
    container: HTMLElement;
    namespace: string;
    html: string;
    url: { href: string; path: string };
  }

  export interface TransitionData {
    current: BarbaPageInfo;
    next: BarbaPageInfo;
  }

  export interface BarbaTransition {
    name?: string;
    sync?: boolean;
    custom?: (data: TransitionData) => boolean;
    once?: (data: TransitionData) => void | Promise<unknown>;
    leave?: (data: TransitionData) => void | Promise<unknown>;
    enter?: (data: TransitionData) => void | Promise<unknown> | gsap.core.Tween;
    after?: (data: TransitionData) => void | Promise<unknown>;
  }

  export interface BarbaOptions {
    transitions?: BarbaTransition[];
    prevent?: (info: { el: HTMLElement }) => boolean;
  }

  type HookFn = (data: TransitionData) => void;

  const barba: {
    init(options?: BarbaOptions): void;
    hooks: {
      before(fn: HookFn): void;
      beforeLeave(fn: HookFn): void;
      afterEnter(fn: HookFn): void;
      after(fn: HookFn): void;
    };
  };

  export default barba;
}
