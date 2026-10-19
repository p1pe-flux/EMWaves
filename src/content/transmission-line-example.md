For this line, substitute the load and characteristic impedance into the general formulas:

$$
\begin{aligned}
z_L(0)&=\frac{100+\iu\,50}{50}=2+\iu,\\
\Gamma_L&=\frac{(2+\iu)-1}{(2+\iu)+1}
=0.4+\iu\,0.2.
\end{aligned}
$$

The reflection coefficient and normalized impedance along the line are therefore

$$
\begin{aligned}
\Gamma(\ell)&=(0.4+\iu\,0.2)e^{-\iu\,2\beta\ell},\\
z_L(\ell)&=
\frac{(2+\iu)\cos(\beta\ell)+\iu\sin(\beta\ell)}
{\cos(\beta\ell)+\iu(2+\iu)\sin(\beta\ell)}.
\end{aligned}
$$

The SWR circle has a constant radius and standing-wave ratio:

$$
\begin{aligned}
|\Gamma|&=\sqrt{0.4^2+0.2^2}=\frac{1}{\sqrt5}\approx0.4472,\\
\mathrm{SWR}&=\frac{1+1/\sqrt5}{1-1/\sqrt5}\approx2.618.
\end{aligned}
$$

The diagram starts at $\ell=0.250\lambda$. Here $\beta\ell=\pi/2$, so

$$
\begin{aligned}
z_L(\lambda/4)&=\frac{1}{2+\iu}=0.4-\iu\,0.2,\\
Z(\lambda/4)&=(20-\iu\,10)\;\Omega.
\end{aligned}
$$

The impedance repeats every $\lambda/2$, while the magnitude of the reflection coefficient remains constant. The full $1\lambda$ line makes two turns around the same SWR circle.
