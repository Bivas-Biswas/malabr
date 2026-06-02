## Abstract Flow

1. malabr client libary:
it will give developer abstact interface like scikit learn. internall it will convert the data in flatbuffers and called the malabr Browser API.

2. malabr browser APIs:
it will handover the data to the mgroup server.

3. malabr server
will do the all works, sent the response.


## Model Support
SVC
LogisticRegression
RandomForestClassifier

## Scikit-learn Function
fit(x, y)
predict(x)
score(x, y)

## Malabr Client API Javascript
class BaseModel:
    id -> uuid generate
    name -> default (model_type+this.id)
    type -> SVC, LinarRegresion... 
    params
    check_status()
    fit(x, y) -> pure virtual function
    predict(x) -> pure virtual function
    score(x, y) -> pure virtual function
    details() -> pure virtual function
    destroy()

class SVC:BaseModel
    params
    fit(x, y)
    predict(x)
    score(x, y)
    details()

class LogisticRegression:BaseModel
    params
    fit(x, y)
    predict(x)
    score(x, y)
    details() 

class RandomForestClassifier:BaseModel
    params
    fit(x, y)
    predict(x)
    score(x, y)
    details() 

## Browser API
chrome.malabr.fit()
params:
type, id, name, params, x, y
return:
bool -> ture/false, training started or not

chrome.malabr.score()
params:
type, id, name, x, y
return: 
score: float Mean accuracy of self.predict(x) w.r.t. y.


chrome.malabr.predict()
params:
type, id, name, x
return:
y_pred: ndarray of shape (n_samples,) Class labels for samples in x.

chrome.malabr.check_status()
params:
type, id, name
return:
if(status === 'failed') {
    return { status: 'failed', error_msg: string};
}
return { status: 'ready' };


## Malabr Server

middleware:
authorization() -> extensioin_id, name, id

mserver archtecture:
1. supervisor process + threadpool -> for inference and test, store 
    all the metadata, clean up logic etc.

2. trainer process -> training with resource limit(memory, time..)
    when training finished, it will save it in the file. And supervisor process load it 
    using mmap() and infer/test it.
