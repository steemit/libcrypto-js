new sjcl.test.TestCase("steemit key codec tests", function (cb) {
 
  var testValues = [{
    username: "username",
    password: "password",
    role: "active",
    sec: "5JamTPvZyQsHf8c2pbN92F1gUY3sJkpW3ZJFzdmfbAJPAXT5aw3",
    pub: "STM5SKxjN1YdrFLgoPcp9KteUmNVdgE8DpTPC9sF6jbjVqP9d2Utq"
  }];

  for (var i = 0; i < testValues.length; i++) {
    var testValue = testValues[i];

    var keys = sjcl.codec.steemit.keysFromPassword(
      testValue.username,
      testValue.password
    );

    var serializedSec = sjcl.codec.steemit.serializePrivateKey(keys[testValue.role].sec);
    var serializedPub = sjcl.codec.steemit.serializePublicKey(keys[testValue.role].pub);

    this.require(testValue.sec == serializedSec, 'secret key: generated ' + serializedSec + ', expected ' + testValue.sec);
    this.require(testValue.pub == serializedPub, 'public key: generated ' + serializedPub + ', expected ' + testValue.pub);
  
    // on deserialization we should expect to recover both points of the public key
    var deserializedPublicKey = sjcl.codec.steemit.deserializePublicKey(serializedPub);
    this.require(
      sjcl.bitArray.equal(
        deserializedPublicKey.get().x,
        keys[testValue.role].pub.get().x
      ),
      "X values of original and deserialized public keys are identical"
    );
     this.require(
      sjcl.bitArray.equal(
        deserializedPublicKey.get().y,
        keys[testValue.role].pub.get().y
      ),
      "Y values of original and deserialized public keys are identical"
    );

    // on deserialization the secret key should be the same
    var deserializedPrivateKey = sjcl.codec.steemit.deserializePrivateKey(serializedSec);
    this.require(
      sjcl.bitArray.equal(
        deserializedPrivateKey.get(),
        keys[testValue.role].sec.get()
      ),
      "original and deserialized secret keys are identical"
    );

  } 
  
  cb();
});
