(provide submitTransaction confirmTransaction executeTransaction revokeTransaction)

(define owners makeList)
(define isOwner makeMap)
(define numOfConfirmationsRequired 2)

