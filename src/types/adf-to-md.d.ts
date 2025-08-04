declare module 'adf-to-md' {
  interface ConversionResult {
    result: string;
    warnings: Set<string>;
  }
  interface Converter {
    convert(adf: any): ConversionResult;
    validate(adf: any): void;
  }
  const converter: Converter;
  export default converter;
}
