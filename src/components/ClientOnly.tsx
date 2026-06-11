
'use client';

import { useState, useEffect, type ReactNode } from 'react';

/**
 * A wrapper component that defers the rendering of its children until the
 * component has mounted on the client side.
 *
 * This is useful for preventing server-client mismatches (hydration errors)
 * when components rely on browser-specific APIs or when browser extensions
 * might interfere with the server-rendered HTML.
 *
 * @param {object} props - The component props.
 * @param {ReactNode} props.children - The children to render only on the client.
 * @returns {ReactNode | null} The children on the client, or null on the server.
 */
export default function ClientOnly({ children }: { children: ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
}
