import * as React from "react";

/** Display maths as native MathML (no runtime library). `mathml` is the inner markup of a <math> element. */
export function DisplayMath({ mathml, label }: { mathml: string; label: string }) {
  return (
    <div
      className="my-5 overflow-x-auto border-y border-rule bg-surface px-4 py-4 text-[1.25rem] text-ink"
      role="math"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: `<math display="block" aria-hidden="true">${mathml}</math>` }}
    />
  );
}

export const EQ = {
  gap: `<mrow><msub><mi>δ</mi><mi>i</mi></msub><mo>=</mo><mi>min</mi><mo>{</mo><mn>1</mn><mo>,</mo><mfrac><mrow><mi>max</mi><mo>(</mo><mn>0</mn><mo>,</mo><msub><mi>b</mi><mi>i</mi></msub><mo>−</mo><msub><mi>x</mi><mi>i</mi></msub><mo>)</mo></mrow><msub><mi>b</mi><mi>i</mi></msub></mfrac><mo>}</mo></mrow>`,
  stress: `<mrow><msub><mi>υ</mi><mi>i</mi></msub><mo>=</mo><msub><mi>δ</mi><mi>i</mi></msub><mspace width="0.2em"/><msup><mi>e</mi><mrow><mo>−</mo><msub><mi>α</mi><mi>i</mi></msub><msub><mi>f</mi><mi>i</mi></msub></mrow></msup><mo>,</mo><mspace width="1.5em"/><msub><mi>c</mi><mi>i</mi></msub><mo>=</mo><mn>1</mn><mo>−</mo><msup><mi>e</mi><mrow><mo>−</mo><msub><mi>α</mi><mi>i</mi></msub><msub><mi>f</mi><mi>i</mi></msub></mrow></msup></mrow>`,
  index: `<mrow><mtext>FSFSI</mtext><mo>=</mo><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>N</mi></munderover><msub><mi>ω</mi><mi>i</mi></msub><msub><mi>υ</mi><mi>i</mi></msub><mo>,</mo><mspace width="1.5em"/><munderover><mo>∑</mo><mi>i</mi><mrow/></munderover><msub><mi>ω</mi><mi>i</mi></msub><mo>=</mo><mn>1</mn></mrow>`,
  optimum: `<mrow><msubsup><mi>f</mi><mi>i</mi><mo>*</mo></msubsup><mo>=</mo><mi>max</mi><mo>{</mo><mn>0</mn><mo>,</mo><mfrac><mn>1</mn><msub><mi>α</mi><mi>i</mi></msub></mfrac><mi>ln</mi><mfrac><mrow><msub><mi>ω</mi><mi>i</mi></msub><msub><mi>δ</mi><mi>i</mi></msub><msub><mi>α</mi><mi>i</mi></msub></mrow><mi>λ</mi></mfrac><mo>}</mo><mo>,</mo><mspace width="1.5em"/><munder><mo>∑</mo><mi>i</mi></munder><msubsup><mi>f</mi><mi>i</mi><mo>*</mo></msubsup><mo>=</mo><mi>F</mi></mrow>`,
  efficiency: `<mrow><mi>E</mi><mo>=</mo><mfrac><msup><mtext>FSFSI</mtext><mo>*</mo></msup><mtext>FSFSI</mtext></mfrac><mo>∈</mo><mo>(</mo><mn>0</mn><mo>,</mo><mn>1</mn><mo>]</mo></mrow>`,
};
