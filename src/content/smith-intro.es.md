### Una breve historia

El diagrama de Smith surgió del trabajo de Phillip H. Smith sobre antenas y líneas de transmisión en Bell Telephone Laboratories. Las mediciones repetidas de ondas estacionarias exigían largos cálculos de impedancia, por lo que buscó una forma gráfica de interpretar esas relaciones. Durante la década de 1930 desarrolló su método a partir de un diagrama rectangular de impedancias anterior y lo publicó en *Electronics* en enero de 1939. [El propio relato de Smith](https://ethw.org/Oral-History:Philip_H._Smith#Complex_Impedances_and_the_Smith_Chart) describe este desarrollo.

El ingeniero japonés [Tōsaku Mizuhashi](https://ethw.org/Smith_Chart) desarrolló de forma independiente un diagrama similar y publicó su trabajo en diciembre de 1937, antes del artículo de Smith.

La idea era hacer visibles los cálculos con números complejos. La animación siguiente muestra el cambio de coordenadas que permite hacerlo.

<!-- smith-chart-animation -->

### Una transformación de Möbius en el plano complejo

Sea $\mathbb{C}$ el plano complejo y $\widehat{\mathbb{C}}=\mathbb{C}\cup\{\infty\}$ su extensión con el punto del infinito. Una [transformación de Möbius](https://maths.dur.ac.uk/users/sabine.boegli/CA2.html#definition-and-first-properties-of-m%C3%B6bius-transformations) es una aplicación fraccionaria lineal

$$
f:\mathbb{C}\longrightarrow\widehat{\mathbb{C}}
\quad/\quad
f(z)=\frac{az+b}{cz+d},
$$

donde $a,b,c,d\in\mathbb{C}$ y $ad-bc\neq 0$. El cociente se aplica cuando $cz+d\neq 0$; en caso contrario, definimos $f(z)=\infty$. En el plano complejo extendido, estas aplicaciones transforman circunferencias y rectas en circunferencias o rectas.

### El diagrama de Smith como caso particular

La [transformación del diagrama de Smith](https://arxiv.org/pdf/1201.4068) es un **caso particular de una transformación de Möbius**, con $a=c=d=1$ y $b=-1$. Su determinante es $ad-bc=2\neq 0$.

Para impedancias pasivas, definimos el semiplano derecho cerrado y el disco unidad cerrado mediante

$$
\begin{aligned}
\overline{\mathbb{H}}_R&=\{z\in\mathbb{C}:\operatorname{Re}z\geq 0\},\\
\overline{\mathbb{D}}&=\{w\in\mathbb{C}:|w|\leq 1\}.
\end{aligned}
$$

Para una impedancia real de referencia $Z_0>0$, escribimos $z=Z/Z_0$. El [coeficiente de reflexión](https://ximera.osu.edu/em/electromagnetics/waves/digInReflectionCoeff) es el cociente complejo entre las amplitudes de las ondas de voltaje reflejada e incidente, evaluadas en el mismo plano de referencia:

$$
\begin{aligned}
\Gamma:\overline{\mathbb{H}}_R&\longrightarrow\overline{\mathbb{D}}\setminus\{1\},\\
\Gamma(z)&=\frac{z-1}{z+1}\\
&=\frac{Z-Z_0}{Z+Z_0}=\frac{\tilde{V}^-}{\tilde{V}^+}.
\end{aligned}
$$

Aquí $\tilde{V}^+$ y $\tilde{V}^-$ son fasores de voltaje, con $\tilde{V}^+\neq 0$. Ninguna impedancia pasiva finita alcanza $\Gamma=1$; al añadir el circuito abierto ideal $z=\infty$, con $\Gamma(\infty)=1$, se obtiene el disco cerrado completo.
