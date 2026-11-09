import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react'
import { LOGIN_SHADER } from './loginColors'

/**
 * Sfondo animato della login (anteprima lg-base, variante D): gradiente in WebGL
 * con ShaderGradient (MIT, github.com/ruucm/shadergradient). Caricato con React.lazy
 * solo dove serve (login e fascia della Dashboard), così three.js non pesa sul resto dell'app.
 */
export default function LoginBackground({ dark, still, speed = 0.32 }: { dark: boolean; still: boolean; speed?: number }) {
  return (
    <ShaderGradientCanvas style={{ position: 'absolute', inset: 0 }} pixelDensity={1} fov={45} lazyLoad={false}>
      <ShaderGradient
        control="props" type="waterPlane" animate={still ? 'off' : 'on'}
        uTime={2} uSpeed={speed} uStrength={3.2} uDensity={1.7} uFrequency={5.5} uAmplitude={0}
        positionX={0} positionY={0} positionZ={0} rotationX={0} rotationY={10} rotationZ={50}
        cAzimuthAngle={180} cPolarAngle={90} cDistance={3.6} cameraZoom={1}
        lightType="3d" reflection={0.1} grain="off"
        {...LOGIN_SHADER[dark ? 'dark' : 'light']}
      />
    </ShaderGradientCanvas>
  )
}
