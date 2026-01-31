/**
 * ContentView - Legacy page component
 *
 * This component is kept for backwards compatibility.
 * The Library page now handles /library/:slug routes with the documentation layout.
 *
 * @deprecated Use Library page instead
 */

import { Navigate, useParams } from 'react-router-dom';

export default function ContentView() {
  const { slug } = useParams<{ slug: string }>();

  // Redirect to the Library page which now handles content view
  return <Navigate to={slug ? `/library/${slug}` : '/library'} replace />;
}
