import { Navigate } from 'react-router-dom';

/**
 * Old /profile screen. Its buttons never did anything (and it carried another
 * store's "Plus" branding), so the route now goes to the real account area.
 */
const Profile = () => <Navigate to="/account" replace />;

export default Profile;
