Para esta línea, sustituimos la carga y la impedancia característica en las fórmulas generales:

$$
\begin{aligned}
z_L(0)&=\frac{100+\iu\,50}{50}=2+\iu,\\
\Gamma_L&=\frac{(2+\iu)-1}{(2+\iu)+1}
=0.4+\iu\,0.2.
\end{aligned}
$$

El coeficiente de reflexión y la impedancia normalizada a lo largo de la línea son, por tanto,

$$
\begin{aligned}
\Gamma(\ell)&=(0.4+\iu\,0.2)e^{-\iu\,2\beta\ell},\\
z_L(\ell)&=
\frac{(2+\iu)\cos(\beta\ell)+\iu\sin(\beta\ell)}
{\cos(\beta\ell)+\iu(2+\iu)\sin(\beta\ell)}.
\end{aligned}
$$

El círculo de ROE tiene radio y relación de onda estacionaria constantes:

$$
\begin{aligned}
|\Gamma|&=\sqrt{0.4^2+0.2^2}=\frac{1}{\sqrt5}\approx0.4472,\\
\mathrm{SWR}&=\frac{1+1/\sqrt5}{1-1/\sqrt5}\approx2.618.
\end{aligned}
$$

El diagrama comienza en $\ell=0.250\lambda$. En ese punto $\beta\ell=\pi/2$, de modo que

$$
\begin{aligned}
z_L(\lambda/4)&=\frac{1}{2+\iu}=0.4-\iu\,0.2,\\
Z(\lambda/4)&=(20-\iu\,10)\;\Omega.
\end{aligned}
$$

La impedancia se repite cada $\lambda/2$, mientras el módulo del coeficiente de reflexión permanece constante. La línea completa de $1\lambda$ produce dos vueltas sobre el mismo círculo de ROE.
