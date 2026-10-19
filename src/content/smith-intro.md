### A brief history

The Smith chart grew out of Phillip H. Smith's work on antennas and transmission lines at Bell Telephone Laboratories. Repeated standing-wave measurements required lengthy impedance calculations, so he sought a graphical way to read those relationships. During the 1930s, he developed his approach from an earlier rectangular impedance chart and published it in *Electronics* in January 1939. [Smith's own account](https://ethw.org/Oral-History:Philip_H._Smith#Complex_Impedances_and_the_Smith_Chart) describes this development.

Japanese engineer [Tōsaku Mizuhashi](https://ethw.org/Smith_Chart) independently developed a similar chart and published his work in December 1937, before Smith's article appeared.

The idea was to make complex-number calculations visible. The animation below shows the change of coordinates behind that idea.

<!-- smith-chart-animation -->

### A Möbius transformation on the complex plane

Let $\mathbb{C}$ denote the complex plane and $\widehat{\mathbb{C}}=\mathbb{C}\cup\{\infty\}$ its extension by the point at infinity. A [Möbius transformation](https://maths.dur.ac.uk/users/sabine.boegli/CA2.html#definition-and-first-properties-of-m%C3%B6bius-transformations) is a fractional linear map

$$
f:\mathbb{C}\longrightarrow\widehat{\mathbb{C}}
\quad/\quad
f(z)=\frac{az+b}{cz+d},
$$

where $a,b,c,d\in\mathbb{C}$ and $ad-bc\neq 0$. The quotient applies when $cz+d\neq 0$; otherwise, we define $f(z)=\infty$. On the extended complex plane, these maps carry circles and straight lines into circles or straight lines.

### The Smith chart as a special case

The [Smith chart transformation](https://arxiv.org/pdf/1201.4068) is a **special case of a Möbius transformation**, with $a=c=d=1$ and $b=-1$. Its determinant is $ad-bc=2\neq 0$.

For passive impedances, define the closed right half-plane and the closed unit disk by

$$
\begin{aligned}
\overline{\mathbb{H}}_R&=\{z\in\mathbb{C}:\operatorname{Re}z\geq 0\},\\
\overline{\mathbb{D}}&=\{w\in\mathbb{C}:|w|\leq 1\}.
\end{aligned}
$$

For a real reference impedance $Z_0>0$, write $z=Z/Z_0$. The [reflection coefficient](https://ximera.osu.edu/em/electromagnetics/waves/digInReflectionCoeff) is the complex ratio of the reflected and incident voltage-wave amplitudes, evaluated at the same reference plane:

$$
\begin{aligned}
\Gamma:\overline{\mathbb{H}}_R&\longrightarrow\overline{\mathbb{D}}\setminus\{1\},\\
\Gamma(z)&=\frac{z-1}{z+1}\\
&=\frac{Z-Z_0}{Z+Z_0}=\frac{\tilde{V}^-}{\tilde{V}^+}.
\end{aligned}
$$

Here $\tilde{V}^+$ and $\tilde{V}^-$ are voltage phasors, with $\tilde{V}^+\neq 0$. No finite passive impedance reaches $\Gamma=1$; adjoining the ideal open circuit $z=\infty$, with $\Gamma(\infty)=1$, gives the full closed disk.
