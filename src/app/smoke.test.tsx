import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusMessage } from '../components/StatusMessage'

describe('smoke', () => {
  it('renders status messages as plain text', () => {
    render(
      <StatusMessage
        title="Permission denied"
        detail="<script>alert(1)</script>"
        variant="error"
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('<script>alert(1)</script>')
    expect(document.querySelector('script')).toBeNull()
  })
})
