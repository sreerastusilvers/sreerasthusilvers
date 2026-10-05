import { useAuth } from '@/contexts/AuthContext';
import { googlePhotoOf, initialsOf, isCustomAvatarUrl } from './avatarUtils';

/** Who is signed in, as the account screens show them: name, email and photo. */
export const useAccountIdentity = () => {
  const { user, userProfile } = useAuth();

  const name =
    userProfile?.name ||
    userProfile?.username ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Customer';
  const customPhoto = isCustomAvatarUrl(userProfile?.avatar) ? userProfile!.avatar! : null;
  const googlePhoto = googlePhotoOf(user);

  return {
    name,
    firstName: name.split(/\s+/)[0],
    email: userProfile?.email || user?.email || '',
    initials: initialsOf(name),
    /** Uploaded photo, else Google photo, else null (show initials). */
    photoUrl: customPhoto || googlePhoto || null,
    customPhoto,
    googlePhoto,
  };
};
