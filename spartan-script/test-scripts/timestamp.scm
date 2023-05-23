(provide transferGold)
(define transferGold
    (lambda (addr1 addr2 amount)
        (begin
            (require #f)
            (if (== (% $timestamp 2) 0)
                ($transfer amount addr1)
                ($transfer amount addr2)
            )
            #t
        )
    )
)