// Utilities
export const logger =
  (section: string) =>
  (message: string) => {
    console.log(`[hbbtv-emu] ${section}: ${message}`);
  };

export interface Collection<T> {
  readonly length: number;
  item(index: number): T | null;
  [index: number]: T;
}

export const createEmptyCollection = <T>(): Collection<T> => ({
  length: 0,
  item: () => null,
});

// https://www.typescriptlang.org/docs/handbook/mixins.html

export type ClassType<T = object> = new (...args: any[]) => T;

// TODO: trovare un modo migliore per il type inference

// biome-ignore format: <ack>
export function compose<T0 extends ClassType>(base: T0): T0;
// biome-ignore format: <ack>
export function compose<T0 extends ClassType, T1 extends ClassType>(base: T0, m1: (base: T0) => T1): T1;
// biome-ignore format: <ack>
export function compose<T0 extends ClassType, T1 extends ClassType, T2 extends ClassType>(base: T0, m1: (base: T0) => T1, m2: (base: T1) => T2,): T2;
// biome-ignore format: <ack>
export function compose<T0 extends ClassType, T1 extends ClassType, T2 extends ClassType, T3 extends ClassType>(base: T0, m1: (base: T0) => T1, m2: (base: T1) => T2, m3: (base: T2) => T3,): T3;
// biome-ignore format: <ack>
export function compose<T0 extends ClassType, T1 extends ClassType, T2 extends ClassType, T3 extends ClassType, T4 extends ClassType,>(base: T0, m1: (base: T0) => T1, m2: (base: T1) => T2, m3: (base: T2) => T3, m4: (base: T3) => T4,): T4;
// biome-ignore format: <ack>
export function compose<T0 extends ClassType, T1 extends ClassType, T2 extends ClassType, T3 extends ClassType, T4 extends ClassType, T5 extends ClassType,>(base: T0, m1: (base: T0) => T1, m2: (base: T1) => T2, m3: (base: T2) => T3, m4: (base: T3) => T4, m5: (base: T4) => T5,): T5;
// biome-ignore format: <ack>
export function compose<T0 extends ClassType, T1 extends ClassType, T2 extends ClassType, T3 extends ClassType, T4 extends ClassType, T5 extends ClassType, T6 extends ClassType,>(base: T0, m1: (base: T0) => T1, m2: (base: T1) => T2, m3: (base: T2) => T3, m4: (base: T3) => T4, m5: (base: T4) => T5, m6: (base: T5) => T6,): T6;
// biome-ignore format: <ack>
export function compose<T0 extends ClassType, T1 extends ClassType, T2 extends ClassType, T3 extends ClassType, T4 extends ClassType, T5 extends ClassType, T6 extends ClassType, T7 extends ClassType,>(base: T0, m1: (base: T0) => T1, m2: (base: T1) => T2, m3: (base: T2) => T3, m4: (base: T3) => T4, m5: (base: T4) => T5, m6: (base: T5) => T6, m7: (base: T6) => T7,): T7;
// biome-ignore format: <ack>
export function compose<T0 extends ClassType, T1 extends ClassType, T2 extends ClassType, T3 extends ClassType, T4 extends ClassType, T5 extends ClassType, T6 extends ClassType, T7 extends ClassType, T8 extends ClassType,>(base: T0, m1: (base: T0) => T1, m2: (base: T1) => T2, m3: (base: T2) => T3, m4: (base: T3) => T4, m5: (base: T4) => T5, m6: (base: T5) => T6, m7: (base: T6) => T7, m8: (base: T7) => T8,): T8;
// biome-ignore format: <ack>
export function compose<T0 extends ClassType, T1 extends ClassType, T2 extends ClassType, T3 extends ClassType, T4 extends ClassType, T5 extends ClassType, T6 extends ClassType, T7 extends ClassType, T8 extends ClassType, T9 extends ClassType,>(base: T0, m1: (base: T0) => T1, m2: (base: T1) => T2, m3: (base: T2) => T3, m4: (base: T3) => T4, m5: (base: T4) => T5, m6: (base: T5) => T6, m7: (base: T6) => T7, m8: (base: T7) => T8, m9: (base: T8) => T9,): T9;
// biome-ignore format: <ack>
export function compose<T0 extends ClassType, T1 extends ClassType, T2 extends ClassType, T3 extends ClassType, T4 extends ClassType, T5 extends ClassType, T6 extends ClassType, T7 extends ClassType, T8 extends ClassType, T9 extends ClassType, T10 extends ClassType,>(base: T0, m1: (base: T0) => T1, m2: (base: T1) => T2, m3: (base: T2) => T3, m4: (base: T3) => T4, m5: (base: T4) => T5, m6: (base: T5) => T6, m7: (base: T6) => T7, m8: (base: T7) => T8, m9: (base: T8) => T9, m10: (base: T9) => T10,): T10;
// biome-ignore format: <ack>

export function compose(base: ClassType, ...mixins: Array<(base: ClassType) => ClassType>): ClassType {
  return mixins.reduce((cls, mixin) => mixin(cls), base);
}
