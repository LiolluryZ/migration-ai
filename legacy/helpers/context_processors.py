import json


def conduit_context(request):
    """Context processor that provides user data for window.__conduit_debug__ interface."""
    if request.user.is_authenticated:
        user_data = {
            "username": request.user.username,
            "email": request.user.email,
            "bio": request.user.bio or None,
            "image": request.user.image or None,
        }
        return {
            "conduit_user_json": json.dumps(user_data),
            "conduit_authenticated": True,
        }
    return {
        "conduit_user_json": "null",
        "conduit_authenticated": False,
    }
