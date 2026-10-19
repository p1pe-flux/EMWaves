### Impedancia a lo largo de una línea de transmisión

<!-- transmission-line-diagram -->

Considera una línea sin pérdidas con $Z_0>0$ real y una carga pasiva $Z_L$. Medimos $\ell$ **desde la carga hacia el generador**, con $\ell=0$ en la carga, y definimos $\beta=2\pi/\lambda$. Usamos la convención fasorial $e^{\iu\omega t}$, tomando la intensidad de corriente como positiva hacia la carga.

En cualquier posición, los fasores de voltaje $\tilde{V}(\ell)$ e intensidad de corriente $\tilde{I}(\ell)$ se expresan en términos de las ondas incidente y reflejada como

$$
\begin{aligned}
\tilde{V}(\ell)&=\tilde{V}^+(\ell)+\tilde{V}^-(\ell),\\
Z_0\tilde{I}(\ell)&=\tilde{V}^+(\ell)-\tilde{V}^-(\ell).
\end{aligned}
$$

Al sumar y restar estas ecuaciones se aísla cada onda viajera:

$$
\tilde{V}^{\pm}(\ell)=\frac{\tilde{V}(\ell)\pm Z_0\tilde{I}(\ell)}{2}.
$$

Para $\tilde{V}^+(\ell)\neq0$, su cociente define el coeficiente de reflexión local:

$$
\begin{aligned}
\Gamma(\ell)&=\frac{\tilde{V}^-(\ell)}{\tilde{V}^+(\ell)}\\
&=\frac{\tilde{V}(\ell)-Z_0\tilde{I}(\ell)}
{\tilde{V}(\ell)+Z_0\tilde{I}(\ell)}.
\end{aligned}
$$

Donde $\tilde{I}(\ell)\neq0$, la impedancia vista hacia la carga y su valor normalizado son

$$
\begin{aligned}
Z(\ell)&=\frac{\tilde{V}(\ell)}{\tilde{I}(\ell)},\\
z_L(\ell)&=\frac{Z(\ell)}{Z_0}
=\frac{\tilde{V}(\ell)}{Z_0\tilde{I}(\ell)}.
\end{aligned}
$$

Al dividir el numerador y el denominador de $\Gamma(\ell)$ por $Z_0\tilde{I}(\ell)$ y despejar $z_L(\ell)$, obtenemos

$$
\begin{aligned}
\Gamma(\ell)&=\frac{z_L(\ell)-1}{z_L(\ell)+1},\\
z_L(\ell)&=\frac{1+\Gamma(\ell)}{1-\Gamma(\ell)}.
\end{aligned}
$$

#### Alejarse de la carga

En una [línea sin pérdidas](https://ximera.osu.edu/electromagnetics/electromagnetics/smithChart/digInSmithChartInputImpedance), las dos ondas adquieren fases opuestas. Si $\tilde{V}_L^{\pm}=\tilde{V}^{\pm}(0)$, entonces

$$
\begin{aligned}
\tilde{V}^+(\ell)&=\tilde{V}_L^+e^{\iu\beta\ell},\\
\tilde{V}^-(\ell)&=\tilde{V}_L^-e^{-\iu\beta\ell}.
\end{aligned}
$$

En la carga, $z_L(0)=Z_L/Z_0$ y $\Gamma_L=\Gamma(0)=(z_L(0)-1)/(z_L(0)+1)$. Al tomar el cociente de las ondas viajeras se obtiene

$$
\begin{aligned}
\Gamma(\ell)&=
\frac{\tilde{V}_L^-e^{-\iu\beta\ell}}
{\tilde{V}_L^+e^{\iu\beta\ell}}\\
&=\Gamma_L e^{-\iu\,2\beta\ell}.
\end{aligned}
$$

Sustituimos esta expresión en la transformación inversa de Smith para obtener la impedancia normalizada en cualquier posición:

$$
z_L(\ell)=\frac{1+\Gamma_L e^{-\iu\,2\beta\ell}}
{1-\Gamma_L e^{-\iu\,2\beta\ell}}.
$$

Al reemplazar $\Gamma_L$ por su expresión en función de $z_L(0)$ y utilizar

$$
\begin{aligned}
1+e^{-\iu\,2\theta}&=2e^{-\iu\theta}\cos\theta,\\
1-e^{-\iu\,2\theta}&=2\iu e^{-\iu\theta}\sin\theta,
\end{aligned}
$$

con $\theta=\beta\ell$, resulta

$$
z_L(\ell)=
\frac{z_L(0)\cos(\beta\ell)+\iu\sin(\beta\ell)}
{\cos(\beta\ell)+\iu z_L(0)\sin(\beta\ell)}.
$$

Dividir por $\cos(\beta\ell)$ da la forma equivalente con tangente donde esta sea finita:

$$
z_L(\ell)=\frac{z_L(0)+\iu\tan(\beta\ell)}
{1+\iu z_L(0)\tan(\beta\ell)}.
$$

Por tanto, la fase de reflexión contiene $2\beta\ell$, mientras que la tangente contiene $\beta\ell$. En múltiplos impares de un cuarto de longitud de onda, la forma seno–coseno da $z_L(\ell)=1/z_L(0)$. Las impedancias infinitas se interpretan como límites. Multiplicamos $z_L(\ell)$ por $Z_0$ para recuperar $Z(\ell)$.

#### Por qué importa el círculo de ROE

Como $|e^{-\iu\,2\beta\ell}|=1$, la propagación conserva $|\Gamma(\ell)|=|\Gamma_L|$. Todas las posiciones pertenecen al **mismo círculo de ROE**. Avanzar hacia el generador hace girar el punto en sentido horario un ángulo de $2\beta\ell=4\pi\ell/\lambda$ radianes, y la impedancia se repite cada $\lambda/2$.

Escribimos $\rho=|\Gamma_L|$. Los valores máximo y mínimo de la amplitud del voltaje se producen cuando las dos ondas se suman en fase o en oposición:

$$
\begin{aligned}
|\tilde{V}|_{\max}&=|\tilde{V}_L^+|(1+\rho),\\
|\tilde{V}|_{\min}&=|\tilde{V}_L^+|(1-\rho).
\end{aligned}
$$

Su cociente es la [relación de onda estacionaria](https://arxiv.org/pdf/1201.4068#page=2):

$$
\mathrm{SWR}=\frac{|\tilde{V}|_{\max}}{|\tilde{V}|_{\min}}
=\frac{1+\rho}{1-\rho}.
$$

El círculo de ROE fija esta relación aunque cambie la impedancia local. Para reflexión total, $\rho=1$ y $\mathrm{SWR}=\infty$.
