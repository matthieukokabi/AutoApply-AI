interface AuthWidgetStateInput {
    isLoaded: boolean;
    hasWidgetMounted: boolean;
    showTimeoutFallback: boolean;
    showWidgetFallback: boolean;
}

export function getAuthWidgetState({
    isLoaded,
    hasWidgetMounted,
    showTimeoutFallback,
    showWidgetFallback,
}: AuthWidgetStateInput) {
    const shouldShowRecoveryCard =
        (showTimeoutFallback && !isLoaded) || showWidgetFallback;
    const shouldShowLoadingCard =
        !shouldShowRecoveryCard && !hasWidgetMounted;
    const shouldHideWidget =
        shouldShowRecoveryCard && !hasWidgetMounted;

    return {
        shouldShowRecoveryCard,
        shouldShowLoadingCard,
        shouldHideWidget,
    };
}
