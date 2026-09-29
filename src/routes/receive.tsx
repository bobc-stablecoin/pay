import { createFileRoute } from '@tanstack/react-router'
import { AppPage } from '../components/app-page'

export const Route = createFileRoute('/receive')({
  component: () => <AppPage view="receive" />,
})
