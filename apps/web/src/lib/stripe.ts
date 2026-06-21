import { loadStripe, type Stripe } from '@stripe/stripe-js'

// Promise única do Stripe.js (carregada uma vez). A chave publicável é segura no bundle.
// Em testes/sem chave, resolve null e os componentes que usam Elements não montam.
const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

export const stripePromise: Promise<Stripe | null> = pk
  ? loadStripe(pk)
  : Promise.resolve(null)
