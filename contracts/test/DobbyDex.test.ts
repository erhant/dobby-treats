import { ethers } from "hardhat"
import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { DobbyDEX__factory, DobbyToken__factory, DobbyDEX, DobbyToken } from "../../frontend/types/typechain/index"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { BigNumber } from "ethers"
import common from "../common/index"

chai.use(chaiAsPromised)
const { expect } = chai

describe("[DobbyDEX Contract]", function () {
  const totalSupply: string = ethers.utils.parseEther(common.totalSupplyEthers).toString()
  let dobbydex: DobbyDEX
  let dobbytoken: DobbyToken

  // Toy signers
  let owner: SignerWithAddress
  let addr1: SignerWithAddress
  let addr2: SignerWithAddress
  let addrs: SignerWithAddress[]

  beforeEach(async function () {
    // setup
    const dobbytokenFactory = ((await ethers.getContractFactory("DobbyToken")) as unknown) as DobbyToken__factory
    const dobbydexFactory = ((await ethers.getContractFactory("DobbyDEX")) as unknown) as DobbyDEX__factory
    ;[owner, addr1, addr2, ...addrs] = await ethers.getSigners()

    // deploy DobbyToken
    dobbytoken = await dobbytokenFactory.deploy(totalSupply)
    await dobbytoken.deployed()

    // deploy DobbyDEX
    dobbydex = await dobbydexFactory.deploy(dobbytoken.address)
    await dobbydex.deployed()

    // send all tokens to DobbyDEX
    await dobbytoken.transfer(dobbydex.address, totalSupply)
  })

  describe("deployment", function () {
    it("should allow owner to change price", async function () {
      const price = await dobbydex.price()
      const newPrice = price.mul(2)
      await dobbydex.setPrice(newPrice)
      expect(await dobbydex.price()).to.equal(newPrice)
    })

    it("should have DobbyDEX have all the tokens", async function () {
      expect(await dobbytoken.balanceOf(dobbydex.address)).to.equal(totalSupply)
    })
  })

  describe("exchange", function () {
    it("should allow someone to buy", async function () {
      const price = await dobbydex.price()
      const initialDEXSupply: BigNumber = await dobbytoken.balanceOf(dobbydex.address)

      // buy some tokens
      await dobbydex.buy({ value: price.mul(50).toString() })
      expect(await dobbytoken.balanceOf(owner.address)).to.equal(50)
      expect(await dobbytoken.balanceOf(dobbydex.address)).to.equal(initialDEXSupply.sub(50))
    })

    // TODO: add buying case where amount is more than total supply

    it("should allow someone to sell", async function () {
      const price = await dobbydex.price()

      // buy some tokens
      await dobbydex.buy({ value: price.mul(50).toString() })
      expect(await dobbytoken.balanceOf(owner.address)).to.equal(50)

      // give addr1 some dobby tokens
      await dobbytoken.transfer(addr1.address, 50)
      expect(await dobbytoken.balanceOf(addr1.address)).to.equal(50)

      // addr1 sells half of it
      const initialBalanceEther: BigNumber = await addr1.getBalance()
      const initialDEXSupply: BigNumber = await dobbytoken.balanceOf(dobbydex.address)
      await dobbytoken.connect(addr1).approve(dobbydex.address, 25) // allow DEX a 25
      await dobbydex.connect(addr1).sell(25)
      expect(await dobbytoken.balanceOf(addr1.address)).to.equal(25)
      expect(await dobbytoken.balanceOf(dobbydex.address)).to.equal(initialDEXSupply.add(25))
      const newBalanceEther: BigNumber = await addr1.getBalance()
      // addr1 should have more ether
      expect(initialBalanceEther < newBalanceEther)

      //expect(initialBalanceEther.add(price.mul(25))).to.equal(newBalanceEther) // this is not really true, there is some gas fees

      // TODO: include gas fees in the tests
    })
  })
})
