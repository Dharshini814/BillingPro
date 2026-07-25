from datetime import datetime

VALID_TRANSITIONS = {
    "trial": ["active", "cancelled"],
    "active": ["past_due", "cancelled"],
    "past_due": ["active", "cancelled"],
    "cancelled": []
}


class InvalidSubscriptionTransition(Exception):
    """Raised when an invalid subscription status transition is attempted."""
    pass


def change_subscription_status(subscription, new_status):
    """
    Validates and updates the subscription status.

    Allowed transitions:
        trial      -> active, cancelled
        active     -> past_due, cancelled
        past_due   -> active, cancelled
        cancelled  -> (none)
    """

    current_status = subscription.status

    # Check whether current status exists
    if current_status not in VALID_TRANSITIONS:
        raise InvalidSubscriptionTransition(
            f"Unknown current status '{current_status}'"
        )

    # Check whether new status exists
    if new_status not in VALID_TRANSITIONS:
        raise InvalidSubscriptionTransition(
            f"Unknown target status '{new_status}'"
        )

    # Already in same state
    if current_status == new_status:
        return subscription

    # Validate transition
    if new_status not in VALID_TRANSITIONS[current_status]:
        raise InvalidSubscriptionTransition(
            f"Invalid transition from '{current_status}' to '{new_status}'"
        )

    # Update status
    subscription.status = new_status
    subscription.status_changed_at = datetime.utcnow()

    # Set cancelled time
    if new_status == "cancelled":
        subscription.cancelled_at = datetime.utcnow()

    return subscription