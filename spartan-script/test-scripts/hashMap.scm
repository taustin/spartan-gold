
;; Define hashmap
(define map1 makeMap)
;; Define nested hashmap
(define map2 makeMap)

;; Set hashmap
(setMap balances $me totalSupply)
;; Set nested hashmap
(setMap (getHash allowed $me) newkey newvalue)

;; Get hashmap
(getMap balances $me)
;; Get nested hashmap
(getMap ((getMap allowed $me) newkey))

;; Has hashmap
(hasMap balances $me)
;; Has nested hashmap
(hasMap ((getMap allowed $me) newkey))

;; Delete hashmap
(deleteMap balances $me)
;; Delete nested hashmap
(deleteMap ((getMap allowed $me) newkey))
