declare module 'general-number' {
    // export interface GeneralNumber {
    //     hex: string
    // }
    export function generalise<T>(gn: Record<T>[]) : Record<GeneralNumber>[]
    export function generalise<T>(gn: T[]) : GeneralNumber[]
    export function generalise<T>(gn: Record<T>) : Record<GeneralNumber>
    export function generalise<T>(gn: T) : GeneralNumber
    // export function generalise<T>(gn: Array<T>) : Array<GeneralNumber>
    class GeneralNumber {
      get binary(): string
      
        get binaryArray(): string[]
      
        get bytes(): number[]
      
        // returns the decimal representation, as a String type. Synonymous with `integer()`.
        get decimal(): string
      
        // returns the decimal representation, as a String type. Synonymous with `decimal()`.
        get integer(): string
      
        // returns the decimal representation, as a Number type (if less than javascript's MAX_SAFE_INTEGER). (Otherwise it will throw).
        get number(): number
      
        get bigInt(): bigint
      
        get boolean(): bigint
      
        get ascii(): string
      
        get utf8(): string
      
        // Safe fallback for accidentally calling '.all' on a GeneralNumber (rather than a GeneralObject, which actuallty supports this property)
        get all(): GeneralNumber

        limbs(limbBitLength: number,numberOfLimbs: undefined | number, returnType?: string, throwErrors?: boolean): string[];
        hex(byteLength: number, butTruncateValueToByteLength?: number): string;
        field(modulus: bigint, noOverflow?: boolean): string
    }
    export function stitchLimbs(_limbs: number[], _limbBits? : number)
}