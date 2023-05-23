(provide totalSupply balanceOf allowance transfer approve transferFrom)

(define balanceOf
    (lambda (addr)
        (getMap balances addr)))

(define transfer
    (lambda (receiver tokens)
        (begin
            (require (>= (getMap balances $sender) tokens))
            (setMap balances $sender (- tokens (getMap balances $sender)))
            (setMap balances receiver (+ tokens
                (if (hasMap balances receiver)
                    (getMap balances receiver)
                    0)))
            #t)))

(define allowance
    (lambda (owner addr)
        (getMap (getMap allowed owner) addr)))

(define approve
    (lambda (addr tokens)
        (begin
            (setMap
                (if (hasMap allowed $sender)
                    (getMap allowed $sender)
                    (setMap allowed $sender makeMap))
                addr tokens)
            #t)))

(define transferFrom
    (lambda (owner buyer tokens)
        (begin
            (require (<= tokens (getMap balances owner)))
            (require (<= tokens (getMap (getMap allowed owner) $sender)))
            (setMap balances owner (- tokens (getMap balances owner)))
            (setMap (getMap allowed owner) $sender (- tokens (getMap (getMap allowed owner) $sender)))
            (setMap balances buyer (+
                (if (hasMap balances buyer)
                    (getMap balances buyer)
                    0)
                tokens))
            #t)))