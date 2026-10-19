### Impedance along a transmission line

<!-- transmission-line-diagram -->

Consider a lossless line with real $Z_0>0$ and a passive load $Z_L$. Measure $\ell$ **from the load toward the generator**, with $\ell=0$ at the load, and set $\beta=2\pi/\lambda$. Use the phasor convention $e^{\iu\omega t}$, taking current as positive toward the load.

At any position, the voltage and current phasors $\tilde{V}(\ell)$ and $\tilde{I}(\ell)$ can be written in terms of the incident and reflected waves as

$$
\begin{aligned}
\tilde{V}(\ell)&=\tilde{V}^+(\ell)+\tilde{V}^-(\ell),\\
Z_0\tilde{I}(\ell)&=\tilde{V}^+(\ell)-\tilde{V}^-(\ell).
\end{aligned}
$$

Adding and subtracting these equations isolates each traveling wave:

$$
\tilde{V}^{\pm}(\ell)=\frac{\tilde{V}(\ell)\pm Z_0\tilde{I}(\ell)}{2}.
$$

For $\tilde{V}^+(\ell)\neq0$, their ratio defines the local reflection coefficient:

$$
\begin{aligned}
\Gamma(\ell)&=\frac{\tilde{V}^-(\ell)}{\tilde{V}^+(\ell)}\\
&=\frac{\tilde{V}(\ell)-Z_0\tilde{I}(\ell)}
{\tilde{V}(\ell)+Z_0\tilde{I}(\ell)}.
\end{aligned}
$$

Where $\tilde{I}(\ell)\neq0$, the impedance seen looking toward the load and its normalized value are

$$
\begin{aligned}
Z(\ell)&=\frac{\tilde{V}(\ell)}{\tilde{I}(\ell)},\\
z_L(\ell)&=\frac{Z(\ell)}{Z_0}
=\frac{\tilde{V}(\ell)}{Z_0\tilde{I}(\ell)}.
\end{aligned}
$$

Dividing the numerator and denominator of $\Gamma(\ell)$ by $Z_0\tilde{I}(\ell)$, then solving for $z_L(\ell)$, gives

$$
\begin{aligned}
\Gamma(\ell)&=\frac{z_L(\ell)-1}{z_L(\ell)+1},\\
z_L(\ell)&=\frac{1+\Gamma(\ell)}{1-\Gamma(\ell)}.
\end{aligned}
$$

#### Moving away from the load

For a [lossless line](https://ximera.osu.edu/electromagnetics/electromagnetics/smithChart/digInSmithChartInputImpedance), the two waves acquire opposite phases. If $\tilde{V}_L^{\pm}=\tilde{V}^{\pm}(0)$, then

$$
\begin{aligned}
\tilde{V}^+(\ell)&=\tilde{V}_L^+e^{\iu\beta\ell},\\
\tilde{V}^-(\ell)&=\tilde{V}_L^-e^{-\iu\beta\ell}.
\end{aligned}
$$

At the load, $z_L(0)=Z_L/Z_0$ and $\Gamma_L=\Gamma(0)=(z_L(0)-1)/(z_L(0)+1)$. Taking the ratio of the traveling waves gives

$$
\begin{aligned}
\Gamma(\ell)&=
\frac{\tilde{V}_L^-e^{-\iu\beta\ell}}
{\tilde{V}_L^+e^{\iu\beta\ell}}\\
&=\Gamma_L e^{-\iu\,2\beta\ell}.
\end{aligned}
$$

Substitute this into the inverse Smith transformation to obtain the normalized impedance at any position:

$$
z_L(\ell)=\frac{1+\Gamma_L e^{-\iu\,2\beta\ell}}
{1-\Gamma_L e^{-\iu\,2\beta\ell}}.
$$

Replacing $\Gamma_L$ by its expression in $z_L(0)$ and using

$$
\begin{aligned}
1+e^{-\iu\,2\theta}&=2e^{-\iu\theta}\cos\theta,\\
1-e^{-\iu\,2\theta}&=2\iu e^{-\iu\theta}\sin\theta,
\end{aligned}
$$

with $\theta=\beta\ell$, gives

$$
z_L(\ell)=
\frac{z_L(0)\cos(\beta\ell)+\iu\sin(\beta\ell)}
{\cos(\beta\ell)+\iu z_L(0)\sin(\beta\ell)}.
$$

Dividing by $\cos(\beta\ell)$ gives the equivalent tangent form wherever the tangent is finite:

$$
z_L(\ell)=\frac{z_L(0)+\iu\tan(\beta\ell)}
{1+\iu z_L(0)\tan(\beta\ell)}.
$$

Thus the reflection phase contains $2\beta\ell$, while the tangent contains $\beta\ell$. At odd quarter wavelengths, the sine–cosine form gives $z_L(\ell)=1/z_L(0)$. Infinite impedances are interpreted as limits. Multiply $z_L(\ell)$ by $Z_0$ to recover $Z(\ell)$.

#### Why the SWR circle matters

Because $|e^{-\iu\,2\beta\ell}|=1$, propagation preserves $|\Gamma(\ell)|=|\Gamma_L|$. All positions therefore lie on the **same SWR circle**. Moving toward the generator rotates the chart point clockwise by $2\beta\ell=4\pi\ell/\lambda$ radians, and the impedance repeats every $\lambda/2$.

Write $\rho=|\Gamma_L|$. The largest and smallest voltage magnitudes occur when the two waves add in phase or in opposition:

$$
\begin{aligned}
|\tilde{V}|_{\max}&=|\tilde{V}_L^+|(1+\rho),\\
|\tilde{V}|_{\min}&=|\tilde{V}_L^+|(1-\rho).
\end{aligned}
$$

Their ratio is the [standing-wave ratio](https://arxiv.org/pdf/1201.4068#page=2):

$$
\mathrm{SWR}=\frac{|\tilde{V}|_{\max}}{|\tilde{V}|_{\min}}
=\frac{1+\rho}{1-\rho}.
$$

The SWR circle fixes this ratio even as the local impedance changes. For total reflection, $\rho=1$ and $\mathrm{SWR}=\infty$.
