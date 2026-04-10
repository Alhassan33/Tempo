// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TempoNFT
 * @notice Minimal ERC-721 for Tempo with:
 *   - Real safeTransferFrom (calls onERC721Received)
 *   - ReentrancyGuard on mint functions
 *   - Mint schedule (allowlistStartTime, publicStartTime)
 *   - Deployed once as implementation, cloned per project
 */

// Minimal IERC721Receiver interface
interface IERC721Receiver {
    function onERC721Received(
        address operator, address from, uint256 tokenId, bytes calldata data
    ) external returns (bytes4);
}

contract TempoNFT {

    // ── Reentrancy guard ──────────────────────────────────────────────────────
    uint256 private _reentrancyStatus;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED     = 2;

    modifier nonReentrant() {
        require(_reentrancyStatus != _ENTERED, "Reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    // ── ERC-721 storage ───────────────────────────────────────────────────────
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _approvals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // ── Collection storage ────────────────────────────────────────────────────
    bool    private _initialized;
    string  public  name;
    string  public  symbol;
    string  private _baseURI;
    string  public  hiddenURI;
    bool    public  revealed;
    string  public  collectionURI;

    uint256 public maxSupply;
    uint256 public totalSupply;
    address public projectOwner;
    address public paymentToken;
    address public platformFeeRecipient;
    uint256 public platformFeeBps;
    uint256 public royaltyBps;

    // ── Public mint ───────────────────────────────────────────────────────────
    bool    public  publicMintActive;
    uint256 public  mintPrice;
    uint256 public  maxPerWallet;
    uint256 public  publicStartTime;   // 0 = no schedule (use publicMintActive flag)
    mapping(address => uint256) public publicMinted;

    // ── Allowlist mint ────────────────────────────────────────────────────────
    bool    public  allowlistActive;
    uint256 public  allowlistPrice;
    uint256 public  allowlistMaxPerWallet;
    uint256 public  allowlistStartTime;  // 0 = no schedule (use allowlistActive flag)
    mapping(address => bool)    public allowlist;
    mapping(address => uint256) public allowlistMinted;

    // ── ERC-721 events ────────────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    // ── Constructor — empty for clone implementation ──────────────────────────
    constructor() { _reentrancyStatus = _NOT_ENTERED; }

    // ── Initialize ────────────────────────────────────────────────────────────
    function initialize(
        string  memory _name,
        string  memory _symbol,
        uint256 _maxSupply,
        uint256 _mintPrice,
        uint256 _royaltyBps,
        uint256 _maxPerWallet,
        address _paymentToken,
        address _platformFeeRecipient,
        uint256 _platformFeeBps,
        address _projectOwner
    ) external {
        require(!_initialized, "Already initialized");
        _initialized          = true;
        _reentrancyStatus     = _NOT_ENTERED;
        name                  = _name;
        symbol                = _symbol;
        maxSupply             = _maxSupply;
        mintPrice             = _mintPrice;
        royaltyBps            = _royaltyBps;
        maxPerWallet          = _maxPerWallet;
        paymentToken          = _paymentToken;
        platformFeeRecipient  = _platformFeeRecipient;
        platformFeeBps        = _platformFeeBps;
        projectOwner          = _projectOwner;
    }

    modifier onlyOwner() { require(msg.sender == projectOwner, "Not owner"); _; }

    // ── ERC-721 core ──────────────────────────────────────────────────────────

    function balanceOf(address owner) public view returns (uint256) {
        require(owner != address(0), "Zero address");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Nonexistent token");
        return owner;
    }

    function approve(address to, uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        require(msg.sender == owner || isApprovedForAll(owner, msg.sender), "Not authorized");
        _approvals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        require(_owners[tokenId] != address(0), "Nonexistent token");
        return _approvals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApproved(msg.sender, tokenId), "Not authorized");
        require(_owners[tokenId] == from, "Wrong owner");
        require(to != address(0), "Zero address");
        _transfer(from, to, tokenId);
    }

    // ── safeTransferFrom — calls onERC721Received on contract recipients ──────

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        require(_isApproved(msg.sender, tokenId), "Not authorized");
        require(_owners[tokenId] == from, "Wrong owner");
        require(to != address(0), "Zero address");
        _transfer(from, to, tokenId);
        _checkOnERC721Received(from, to, tokenId, data);
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        delete _approvals[tokenId];
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function _checkOnERC721Received(
        address from, address to, uint256 tokenId, bytes memory data
    ) internal {
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data)
                returns (bytes4 retval)
            {
                require(retval == IERC721Receiver.onERC721Received.selector, "ERC721: transfer to non ERC721Receiver");
            } catch (bytes memory reason) {
                if (reason.length == 0) revert("ERC721: transfer to non ERC721Receiver");
                assembly { revert(add(32, reason), mload(reason)) }
            }
        }
    }

    function _isApproved(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return spender == owner ||
               isApprovedForAll(owner, spender) ||
               getApproved(tokenId) == spender;
    }

    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "Zero address");
        _balances[to]++;
        _owners[tokenId] = to;
        emit Transfer(address(0), to, tokenId);
    }

    // ── Token URI ─────────────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "Nonexistent token");
        if (!revealed) return hiddenURI;
        if (bytes(_baseURI).length == 0) return "";
        return string(abi.encodePacked(_baseURI, _uint2str(tokenId), ".json"));
    }

    // ── ERC-165 ───────────────────────────────────────────────────────────────

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x80ac58cd   // ERC-721
            || id == 0x5b5e139f   // ERC-721Metadata
            || id == 0x2a55205a   // ERC-2981
            || id == 0x01ffc9a7;  // ERC-165
    }

    // ── ERC-2981 royalty ──────────────────────────────────────────────────────

    function royaltyInfo(uint256, uint256 salePrice) external view returns (address, uint256) {
        return (projectOwner, (salePrice * royaltyBps) / 10000);
    }

    // ── Payment ───────────────────────────────────────────────────────────────

    function _pay(uint256 total) internal {
        if (total == 0) return;
        uint256 cut = (total * platformFeeBps) / 10000;
        _erc20TransferFrom(msg.sender, platformFeeRecipient, cut);
        _erc20TransferFrom(msg.sender, projectOwner, total - cut);
    }

    function _erc20TransferFrom(address from, address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok, ) = paymentToken.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount)
        );
        require(ok, "Payment failed");
    }

    function _mintBatch(address to, uint256 qty) internal {
        require(totalSupply + qty <= maxSupply, "Exceeds supply");
        for (uint256 i = 0; i < qty; i++) {
            _mint(to, totalSupply);
            totalSupply++;
        }
    }

    // ── Allowlist mint ────────────────────────────────────────────────────────
    // Active if: allowlistActive flag is true AND (no schedule OR past startTime)

    function allowlistMint(uint256 qty) external nonReentrant {
        require(allowlistActive, "Allowlist not active");
        require(
            allowlistStartTime == 0 || block.timestamp >= allowlistStartTime,
            "Allowlist mint not started"
        );
        require(allowlist[msg.sender], "Not on allowlist");
        require(
            allowlistMaxPerWallet == 0 || allowlistMinted[msg.sender] + qty <= allowlistMaxPerWallet,
            "Exceeds limit"
        );
        allowlistMinted[msg.sender] += qty;
        _pay(allowlistPrice * qty);
        _mintBatch(msg.sender, qty);
    }

    // ── Public mint ───────────────────────────────────────────────────────────
    // Active if: publicMintActive flag is true AND (no schedule OR past startTime)

    function mint(uint256 qty) external nonReentrant {
        require(publicMintActive, "Mint not active");
        require(
            publicStartTime == 0 || block.timestamp >= publicStartTime,
            "Public mint not started"
        );
        require(
            maxPerWallet == 0 || publicMinted[msg.sender] + qty <= maxPerWallet,
            "Exceeds limit"
        );
        publicMinted[msg.sender] += qty;
        _pay(mintPrice * qty);
        _mintBatch(msg.sender, qty);
    }

    // ── View: mint schedule status ────────────────────────────────────────────

    function getMintStatus() external view returns (
        bool alActive, bool alStarted, uint256 alStartsIn,
        bool pubActive, bool pubStarted, uint256 pubStartsIn
    ) {
        alActive   = allowlistActive;
        alStarted  = allowlistStartTime == 0 || block.timestamp >= allowlistStartTime;
        alStartsIn = (!alStarted && allowlistStartTime > block.timestamp)
                     ? allowlistStartTime - block.timestamp : 0;

        pubActive   = publicMintActive;
        pubStarted  = publicStartTime == 0 || block.timestamp >= publicStartTime;
        pubStartsIn = (!pubStarted && publicStartTime > block.timestamp)
                      ? publicStartTime - block.timestamp : 0;
    }

    // ── Owner controls ────────────────────────────────────────────────────────

    function setCollectionURI(string memory uri)  external onlyOwner { collectionURI = uri; }
    function setHiddenURI(string memory uri)       external onlyOwner { hiddenURI = uri; }
    function reveal(string memory baseURI)         external onlyOwner { _baseURI = baseURI; revealed = true; }

    // Public mint
    function setPublicMintActive(bool v) external onlyOwner { publicMintActive = v; if (v) allowlistActive = false; }
    function setMintPrice(uint256 v)               external onlyOwner { mintPrice = v; }
    function setMaxPerWallet(uint256 v)            external onlyOwner { maxPerWallet = v; }
    function setPublicStartTime(uint256 ts)        external onlyOwner { publicStartTime = ts; }

    // Allowlist mint
    function setAllowlistActive(bool v) external onlyOwner { allowlistActive = v; if (v) publicMintActive = false; }
    function setAllowlistPrice(uint256 v)          external onlyOwner { allowlistPrice = v; }
    function setAllowlistMaxPerWallet(uint256 v)   external onlyOwner { allowlistMaxPerWallet = v; }
    function setAllowlistStartTime(uint256 ts)     external onlyOwner { allowlistStartTime = ts; }
    function setAllowlist(address a, bool v)       external onlyOwner { allowlist[a] = v; }
    function setAllowlistBatch(address[] calldata addrs, bool v) external onlyOwner {
        for (uint256 i = 0; i < addrs.length; i++) allowlist[addrs[i]] = v;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        projectOwner = newOwner;
    }

    // ── Utils ─────────────────────────────────────────────────────────────────

    function _uint2str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tmp = v; uint256 len;
        while (tmp != 0) { len++; tmp /= 10; }
        bytes memory buf = new bytes(len);
        while (v != 0) { buf[--len] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(buf);
    }
}
